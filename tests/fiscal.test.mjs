import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateResicoIsr, RULESET, simulationReport } from '../packages/fiscal/index.mjs';
import { calculatorView, calculationResult } from '../public/calculator-view.mjs';
const run = (income, withholding = '0.00', year = 2026) => calculateResicoIsr({ income, withholding, year });

test('tabla mensual: límites y centavo siguiente aplican la tasa al ingreso completo', () => {
  const cases = [
    ['0.00', '1.00%', '0.00'], ['25000.00', '1.00%', '250.00'],
    ['25000.01', '1.10%', '275.00'], ['50000.00', '1.10%', '550.00'],
    ['50000.01', '1.50%', '750.00'], ['83333.33', '1.50%', '1250.00'],
    ['83333.34', '2.00%', '1666.67'], ['208333.33', '2.00%', '4166.67'],
    ['208333.34', '2.50%', '5208.33'], ['3500000.00', '2.50%', '87500.00'],
  ];
  for (const [income, rate, gross] of cases) {
    const result = run(income); assert.equal(result.rate, rate, income); assert.equal(result.grossIsr, gross, income);
  }
  assert.throws(() => run('3500000.01'), /outside_table/);
});
test('retenciones del ejemplo se restan sin producir impuestos negativos', () => {
  const ordinary = run('20000.00', '125.00'); assert.equal(ordinary.estimatedIsr,'75.00'); assert.equal(ordinary.unappliedWithholding,'0.00');
  const excess = run('48000.00', '600.00'); assert.equal(excess.grossIsr,'528.00'); assert.equal(excess.estimatedIsr,'0.00'); assert.equal(excess.unappliedWithholding,'72.00'); assert.equal(excess.requiresWithholdingReview,true);
  const exact = run('20000.00','200.00'); assert.equal(exact.estimatedIsr,'0.00'); assert.equal(exact.requiresWithholdingReview,false);
});
test('aritmética decimal reproduce centavos y empates de redondeo sin coma flotante', () => {
  assert.equal(run('150.49').grossIsr,'1.50');
  assert.equal(run('150.50').grossIsr,'1.51');
  assert.equal(run('150.51').grossIsr,'1.51');
  assert.equal(run('0.01').grossIsr,'0.00');
  assert.equal(run('000048000.00').income,'48000.00');
});
test('rechaza entradas ambiguas, valores inválidos y ejercicios sin reglas', () => {
  for (const income of ['', '-1', 'NaN', 'Infinity', '1e6', '48,000.00', '$100', '100,50', '1.001', 48000, null, ' 100', '9'.repeat(200)]) assert.throws(() => run(income), /invalid_amount/);
  assert.throws(() => run('100.00','101.00'), /withholding_exceeds_income/);
  assert.throws(() => run('100.00','0.00',2027), /unsupported_year/);
  assert.throws(() => calculateResicoIsr({income:'100',withholding:'0',year:2026,expenses:'99'}), /invalid_input/);
});
test('resultado reproducible identifica regla, límites y pasos sin modificar entradas', () => {
  const input = Object.freeze({income:'48000.00',withholding:'0.00',year:2026});
  const a = calculateResicoIsr(input), b = calculateResicoIsr(input);
  assert.deepEqual(a,b); assert.equal(a.ruleSet,RULESET.id); assert.equal(a.status,'simulation'); assert.equal(a.eligibility,'not_assessed');
  assert.equal(a.steps.length,4); assert.equal(a.steps[3].amount,'528.00'); assert.doesNotThrow(() => JSON.stringify(a));
});
test('desglose descargable conserva entradas y no aparenta una declaración o devolución', () => {
  const report = simulationReport(run('48000.00','600.00'));
  for (const text of ['SIN VALIDEZ FISCAL', RULESET.id, '48000.00', '600.00', '72.00', 'No reconoce devolución', RULESET.source]) assert.ok(report.includes(text),text);
});
test('vista escapa entradas y retira resultados obsoletos o inválidos', () => {
  const html = calculatorView({income:'"><script>alert(1)</script>',withholding:'0'},null,'invalid_amount');
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!calculationResult(null,null).includes('calculator-download'));
  assert.ok(!calculationResult(null,'outside_table').includes('ISR estimado después'));
  assert.ok(calculationResult(run('48000','600'),null).includes('no reconoce una devolución'));
});

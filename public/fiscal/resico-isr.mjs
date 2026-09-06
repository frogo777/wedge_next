// Pure, versioned arithmetic. No network, browser state, IA or payment effects.
export const RULESET = Object.freeze({
  id: 'mx-resico-pf-isr-monthly-2026.v1',
  year: 2026,
  reviewedOn: '2026-09-06',
  source: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf',
  articles: ['113-E', '113-J'],
  scope: 'general_monthly_table_simulation',
});
export const BANDS = Object.freeze([
  { ceilingCents: 2500000n, basisPoints: 100n, label: '1.00%' },
  { ceilingCents: 5000000n, basisPoints: 110n, label: '1.10%' },
  { ceilingCents: 8333333n, basisPoints: 150n, label: '1.50%' },
  { ceilingCents: 20833333n, basisPoints: 200n, label: '2.00%' },
  { ceilingCents: 350000000n, basisPoints: 250n, label: '2.50%' },
].map(Object.freeze));

export function parseAmount(value) {
  if (typeof value !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) throw new Error('invalid_amount');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function formatAmount(cents) {
  if (typeof cents !== 'bigint' || cents < 0n) throw new Error('invalid_cents');
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

export function calculateResicoIsr(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['income', 'withholding', 'year'].includes(k))) throw new Error('invalid_input');
  if (input.year !== RULESET.year) throw new Error('unsupported_year');
  const income = parseAmount(input.income);
  const withholding = parseAmount(input.withholding);
  const band = BANDS.find(b => income <= b.ceilingCents);
  if (!band) throw new Error('outside_table');
  // Only current-month withholding is supported; no carry-forwards or balances.
  if (withholding > income) throw new Error('withholding_exceeds_income');
  // Exact integer arithmetic; final cents use half-up display rounding.
  // This does not implement the SAT form's whole-peso payment adjustments.
  const gross = (income * band.basisPoints + 5000n) / 10000n;
  const applied = withholding < gross ? withholding : gross;
  const remainder = gross - applied;
  const excess = withholding - applied;
  return {
    ruleSet: RULESET.id, year: input.year, source: RULESET.source,
    income: formatAmount(income), withholding: formatAmount(withholding),
    rate: band.label, bandCeiling: formatAmount(band.ceilingCents),
    grossIsr: formatAmount(gross), appliedWithholding: formatAmount(applied),
    estimatedIsr: formatAmount(remainder), unappliedWithholding: formatAmount(excess),
    requiresWithholdingReview: excess > 0n,
    status: 'simulation', eligibility: 'not_assessed',
    rounding: 'half_up_cents_for_simulation',
    steps: [
      { operation: 'monthly_income_excluding_vat', amount: formatAmount(income) },
      { operation: 'rate_on_entire_income', rate: band.label, amount: formatAmount(gross) },
      { operation: 'subtract_current_month_withholding', amount: formatAmount(applied) },
      { operation: 'estimated_isr', amount: formatAmount(remainder) },
    ],
  };
}

export function simulationReport(result) {
  return `WEDGE — SIMULACIÓN DE ISR RESICO\nSIN VALIDEZ FISCAL. NO ES DECLARACIÓN NI COMPROBANTE DE PAGO.\n\nRegla: ${result.ruleSet}\nEjercicio del ejemplo: ${result.year}\nIngreso mensual cobrado, sin IVA: $${result.income} MXN\nTasa sobre todo el ingreso: ${result.rate}\nISR antes de retenciones: $${result.grossIsr} MXN\nRetenciones indicadas del mes: $${result.withholding} MXN\nRetenciones aplicadas en el ejemplo: $${result.appliedWithholding} MXN\nISR estimado: $${result.estimatedIsr} MXN\nRetenciones pendientes de revisión: $${result.unappliedWithholding} MXN\n\nNo determina elegibilidad ni límites anuales. No incluye IVA, estímulos, exenciones, saldos previos o ajustes del formulario SAT. No reconoce devolución ni saldo a favor automático. Redondeo a centavos para simulación; requiere revisión profesional antes de uso fiscal.\nFuente: ${result.source}\nArtículos 113-E y 113-J. Consulta: ${RULESET.reviewedOn}.\n`;
}

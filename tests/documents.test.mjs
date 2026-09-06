import test from 'node:test';
import assert from 'node:assert/strict';
import { readCfdi, analyzeDocument, MAX_XML_BYTES } from '../packages/documents/read-cfdi.mjs';
import { samples, sampleIds } from '../packages/documents/demo-samples.mjs';
import { exampleCards, documentsView } from '../public/document-view.mjs';

test('extrae metadatos del XML conservando importes como texto', () => {
  const r = readCfdi(samples.service);
  assert.equal(r.status, 'read'); assert.equal(r.metadata.total, '6960.00');
  assert.equal(r.metadata.paymentMethod, 'PUE'); assert.equal(r.fiscalStatus, 'not_verified');
  assert.equal(r.metadata.emitter.name, 'ESTUDIO DEMO WEDGE');
  assert.equal(readCfdi(samples.service.replace('6960.00', '999999999999999999.123456')).metadata.total, '999999999999999999.123456');
});
test('usa namespaces y parentesco, no un prefijo textual o timbre escondido', () => {
  const renamed = samples.service.replaceAll('cfdi:', 'invoice:').replace('xmlns:cfdi', 'xmlns:invoice');
  assert.equal(readCfdi(renamed).status, 'read');
  assert.equal(readCfdi(samples.service.replace('http://www.sat.gob.mx/cfd/4', 'https://evil.test')).status, 'rejected');
  assert.equal(readCfdi(samples.service.replace('<tfd:TimbreFiscalDigital', '<fake><tfd:TimbreFiscalDigital').replace('/></cfdi:Complemento>', '/></fake></cfdi:Complemento>')).status, 'rejected');
});
test('rechaza XML roto, DTD, entidades, documentos grandes y exceso de nodos', () => {
  for (const value of [samples.service.slice(0,-20), '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///secret">]>'+samples.service, 'a'.repeat(MAX_XML_BYTES+1), '<r>'+ '<a/>'.repeat(2049)+'</r>']) assert.equal(readCfdi(value).status,'rejected');
  assert.equal(readCfdi(samples.service.replace('<cfdi:Conceptos>', '<cfdi:Conceptos>'+ '<a>'.repeat(65)).replace('</cfdi:Conceptos>', '</a>'.repeat(65)+'</cfdi:Conceptos>')).status, 'rejected');
});
test('rechaza fechas imposibles, importes inválidos y timbres ausentes o duplicados', () => {
  for (const value of [samples.no_stamp, samples.service.replace('2026-08-20','2026-02-30'), samples.service.replace('6960.00','-1'), samples.service.replace('6960.00','1e3'), samples.service.replace('00000000-0000-4000-8000-000000000001','bad-id')]) assert.equal(readCfdi(value).status, 'rejected');
  const stamp = samples.service.match(/<tfd:TimbreFiscalDigital[^>]+\/>/)[0];
  assert.equal(readCfdi(samples.service.replace(stamp,stamp+stamp)).status,'rejected');
});
test('señala periodo, PPD y moneda sin declarar autenticidad ni cobro', () => {
  assert.deepEqual(readCfdi(samples.july).issues,['other_period']);
  assert.deepEqual(readCfdi(samples.deferred).issues,['collection_review']);
  assert.deepEqual(readCfdi(samples.service.replace('Moneda="MXN"','Moneda="USD"')).issues,['currency_review']);
});
test('distingue copia exacta y contenido diferente con el mismo folio', async () => {
  const first=await analyzeDocument('service',samples.service);
  assert.equal(first.fingerprint.length,64);
  assert.equal((await analyzeDocument('copy',samples.copy,[first])).status,'duplicate');
  assert.equal((await analyzeDocument('conflict',samples.conflict,[first])).status,'conflict');
  const lower=samples.service.replace('000000000001','abcdefabcdef');
  assert.equal(readCfdi(lower).metadata.uuid.endsWith('ABCDEFABCDEF'),true);
});
test('la vista escapa nombres y el catálogo solo ofrece ejemplos permitidos', () => {
  const parsed=readCfdi(samples.service.replace('ESTUDIO DEMO WEDGE','&lt;img src=x onerror=alert(1)&gt;'));
  const html=documentsView([{sampleId:'service',fingerprint:'test',...parsed}],true,false,null);
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
  assert.deepEqual(exampleCards.map(([id])=>id),sampleIds);
  assert.ok(html.includes('sin validez fiscal'));assert.ok(!html.includes('type="file"'));
});

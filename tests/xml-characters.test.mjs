import test from 'node:test';
import assert from 'node:assert/strict';
import { readCfdi, analyzeDocument, MAX_XML_BYTES } from '../packages/documents/read-cfdi.mjs';
import { samples } from '../packages/documents/demo-samples.mjs';

test('XML: rechaza caracteres prohibidos literales y referencias en atributos o texto', () => {
  for (const cp of [0, 1, 8, 11, 12, 14, 31, 0xD800, 0xDFFF, 0xFFFE, 0xFFFF]) {
    for (const value of [String.fromCodePoint(cp), `&#${cp};`, `&#x${cp.toString(16)};`]) {
      const attribute = samples.service.replace('ESTUDIO DEMO WEDGE', value);
      const text = samples.service.replace('</cfdi:Conceptos>', `${value}</cfdi:Conceptos>`);
      for (const xml of [attribute, text]) {
        const result = readCfdi(xml);
        assert.equal(result.status, 'rejected', `code point ${cp}`);
        assert.deepEqual(result.issues, ['invalid_xml']);
        assert.equal(result.metadata, null);
      }
    }
  }
});

test('XML: conserva caracteres válidos y referencias, sin interpretar comentarios o CDATA como entidades', () => {
  const name = 'ESTUDIO ÁÉÑ &amp; &#x1F600; &#9; &#10; &#13;';
  const parsed = readCfdi(samples.service.replace('ESTUDIO DEMO WEDGE', name));
  assert.equal(parsed.status, 'read');
  assert.ok(parsed.metadata.emitter.name.includes('ÁÉÑ & 😀'));
  for (const cp of [0x20, 0xD7FF, 0xE000, 0x10000, 0x10FFFF]) {
    assert.equal(readCfdi(samples.service.replace('ESTUDIO DEMO WEDGE', String.fromCodePoint(cp))).status, 'read', String(cp));
  }
  for (const literal of ['<!-- &#x0; -->', '<![CDATA[&#x0;]]>']) {
    assert.equal(readCfdi(samples.service.replace('</cfdi:Conceptos>', `${literal}</cfdi:Conceptos>`)).status, 'read');
  }
  // Existing conservative policy: parser warnings reject even a literal U+FFFD,
  // which may indicate a previous lossy decode. This is stricter than XML 1.0.
  assert.equal(readCfdi(samples.service.replace('ESTUDIO DEMO WEDGE', '\uFFFD')).status, 'rejected');
});

test('XML: normaliza saltos XML 1.0 sin transformar separadores Unicode propios de XML 1.1', () => {
  const name = 'ESTUDIO\u0085A\u2028B\u2029C';
  const xml = samples.service.replace('ESTUDIO DEMO WEDGE', name);
  for (const source of [xml, xml.replaceAll('\n', '\r\n'), xml.replaceAll('\n', '\r')]) {
    const parsed = readCfdi(source);
    assert.equal(parsed.status, 'read');
    assert.equal(parsed.metadata.emitter.name, name);
  }
});

test('XML: limita la lectura a XML 1.0 sin exigir declaración ni un prefijo fijo', () => {
  for (const version of ['1.1', '2.0']) assert.equal(readCfdi(samples.service.replace('version="1.0"', `version="${version}"`)).status, 'rejected');
  assert.equal(readCfdi(samples.service.replace('<?xml version="1.0" encoding="UTF-8"?>', '')).status, 'read');
  assert.equal(readCfdi(samples.service.replace('version="1.0"', "version='1.0'")).status, 'read');
});

test('XML: análisis rechaza antes de generar una huella engañosa o procesar entradas fuera de límite', async () => {
  for (const xml of [null, '', 'x'.repeat(MAX_XML_BYTES + 1), samples.service.replace('ESTUDIO', '\ud800')]) {
    const result = await analyzeDocument('synthetic-invalid', xml);
    assert.equal(result.status, 'rejected');
    assert.equal(result.fingerprint, null);
    assert.equal(result.metadata, null);
  }
  const valid = await analyzeDocument('synthetic-valid', samples.service);
  assert.match(valid.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(valid.fiscalStatus, 'not_verified');
});

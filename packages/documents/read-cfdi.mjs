import { DOMParser } from '@xmldom/xmldom';

const CFDI = 'http://www.sat.gob.mx/cfd/4';
const TFD = 'http://www.sat.gob.mx/TimbreFiscalDigital';
export const MAX_XML_BYTES = 128 * 1024;
const reject = code => ({ status: 'rejected', issues: [code], metadata: null });
const children = (node, ns, name) => Array.from(node.childNodes).filter(n => n.nodeType === 1 && n.namespaceURI === ns && n.localName === name);
const attr = (node, name) => node.getAttribute(name) || '';

// XML 1.0, production [2] Char. Check both input and decoded DOM values:
// xmldom can preserve forbidden characters, including those in numeric references.
function validXmlCharacters(text) {
  for (const character of text) {
    const cp = character.codePointAt(0);
    if (!(cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp <= 0xD7FF)
      || (cp >= 0xE000 && cp <= 0xFFFD) || (cp >= 0x10000 && cp <= 0x10FFFF))) return false;
  }
  return true;
}

// Structural extraction only. No XSD, certificate, SAT status or tax validation.
// Never fetch URLs from XML. The public API only accepts bundled example IDs.
export function readCfdi(xml, period = '2026-08') {
  if (typeof xml !== 'string') return reject('empty_xml');
  if (xml.length > MAX_XML_BYTES || new TextEncoder().encode(xml).byteLength > MAX_XML_BYTES) return reject('file_too_large');
  if (!xml.trim()) return reject('empty_xml');
  if (!validXmlCharacters(xml)) return reject('invalid_xml');
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) return reject('unsafe_xml');
  if ((xml.match(/</g) || []).length > 2048) return reject('too_complex');
  let doc;
  try {
    doc = new DOMParser({
      onError() { throw new Error('Invalid XML'); },
      // xmldom defaults to XML 1.1 normalization; this reader supports XML 1.0.
      normalizeLineEndings: input => input.replace(/\r\n?/g, '\n'),
    }).parseFromString(xml, 'application/xml');
  } catch { return reject('invalid_xml'); }
  const declaration = Array.from(doc.childNodes).find(n => n.nodeType === 7 && n.target === 'xml');
  if (declaration && !/^version\s*=\s*(['"])1\.0\1(?:\s|$)/.test(declaration.data)) return reject('invalid_xml');
  const root = doc.documentElement;
  if (!root || root.namespaceURI !== CFDI || root.localName !== 'Comprobante' || attr(root, 'Version') !== '4.0') return reject('unsupported_version');
  const stack = [[root, 1]];
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (depth > 64) return reject('too_complex');
    if (!validXmlCharacters(node.nodeValue || '')) return reject('invalid_xml');
    if (node.nodeType === 1 && Array.from(node.attributes).some(a => !validXmlCharacters(a.value))) return reject('invalid_xml');
    for (const child of Array.from(node.childNodes || [])) stack.push([child, depth + (child.nodeType === 1 ? 1 : 0)]);
  }
  const emitters = children(root, CFDI, 'Emisor');
  const receivers = children(root, CFDI, 'Receptor');
  if (emitters.length !== 1 || receivers.length !== 1) return reject('missing_parties');
  const emitter = emitters[0], receiver = receivers[0];
  if (!attr(emitter, 'Rfc') || !attr(emitter, 'Nombre') || !attr(receiver, 'Rfc') || !attr(receiver, 'Nombre')) return reject('missing_parties');
  if ([emitter, receiver].some(n => attr(n, 'Nombre').length > 254 || attr(n, 'Rfc').length > 13)) return reject('invalid_parties');
  const complements = children(root, CFDI, 'Complemento');
  const stamps = complements.flatMap(n => children(n, TFD, 'TimbreFiscalDigital'));
  if (stamps.length !== 1 || attr(stamps[0], 'Version') !== '1.1') return reject('missing_stamp');
  const uuid = attr(stamps[0], 'UUID').toUpperCase();
  if (!/^[A-F0-9]{8}-(?:[A-F0-9]{4}-){3}[A-F0-9]{12}$/.test(uuid)) return reject('invalid_uuid');
  const date = attr(root, 'Fecha');
  const parsedDate = new Date(date + 'Z');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 19) !== date) return reject('invalid_date');
  const total = attr(root, 'Total');
  // Preserve decimal text; no floating-point arithmetic or tax calculation here.
  if (!/^\d{1,18}(?:\.\d{1,6})?$/.test(total)) return reject('invalid_total');
  const currency = attr(root, 'Moneda');
  if (!/^[A-Z]{3}$/.test(currency)) return reject('invalid_currency');
  const type = attr(root, 'TipoDeComprobante');
  if (!['I', 'E', 'T', 'N', 'P'].includes(type)) return reject('invalid_type');
  const paymentMethod = attr(root, 'MetodoPago');
  if (paymentMethod && !['PUE', 'PPD'].includes(paymentMethod)) return reject('invalid_payment_method');
  const issues = [];
  if (date.slice(0, 7) !== period) issues.push('other_period');
  if (currency !== 'MXN') issues.push('currency_review');
  if (type !== 'I') issues.push('type_review');
  if (!paymentMethod) issues.push('payment_method_missing');
  if (paymentMethod === 'PPD') issues.push('collection_review');
  return {
    status: issues.length ? 'review' : 'read', issues,
    metadata: { uuid, date, total, currency, type, paymentMethod, emitter: { rfc: attr(emitter, 'Rfc'), name: attr(emitter, 'Nombre') }, receiver: { rfc: attr(receiver, 'Rfc'), name: attr(receiver, 'Nombre') } },
    fiscalStatus: 'not_verified',
  };
}

export async function analyzeDocument(sampleId, xml, existing = []) {
  const parsed = readCfdi(xml);
  // Do not allocate/hash oversized input or replace invalid Unicode while encoding.
  if (parsed.issues.some(code => ['empty_xml', 'file_too_large', 'invalid_xml'].includes(code))) return { sampleId, fingerprint: null, ...parsed };
  const bytes = new TextEncoder().encode(xml);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  const prior = parsed.metadata && existing.find(d => ['read', 'review'].includes(d.status) && d.metadata?.uuid === parsed.metadata.uuid);
  if (prior) return { sampleId, fingerprint, ...parsed, status: prior.fingerprint === fingerprint ? 'duplicate' : 'conflict', issues: [prior.fingerprint === fingerprint ? 'duplicate_uuid' : 'conflicting_uuid'] };
  return { sampleId, fingerprint, ...parsed };
}

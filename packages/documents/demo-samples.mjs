// Authored synthetic fixtures. Intentionally omit real certificates and signatures.
// These are NOT valid invoices and must never be submitted to SAT.
const base = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-08-20T12:00:00" Total="6960.00" Moneda="MXN" TipoDeComprobante="I" MetodoPago="PUE">
 <cfdi:Emisor Rfc="XAXX010101000" Nombre="ESTUDIO DEMO WEDGE"/>
 <cfdi:Receptor Rfc="XEXX010101000" Nombre="CLIENTE FICTICIO"/>
 <cfdi:Conceptos><cfdi:Concepto Descripcion="SERVICIO FICTICIO SIN VALIDEZ FISCAL"/></cfdi:Conceptos>
 <cfdi:Complemento><tfd:TimbreFiscalDigital Version="1.1" UUID="00000000-0000-4000-8000-000000000001"/></cfdi:Complemento>
</cfdi:Comprobante>`;
export const samples = Object.freeze({
  service: base,
  copy: base,
  no_stamp: base.replace(/<cfdi:Complemento>.*<\/cfdi:Complemento>/, ''),
  july: base.replace('2026-08-20', '2026-07-20').replace('000000000001', '000000000002'),
  deferred: base.replace('MetodoPago="PUE"', 'MetodoPago="PPD"').replace('000000000001', '000000000003'),
  conflict: base.replace('6960.00', '8000.00'),
});
export const sampleIds = Object.freeze(Object.keys(samples));

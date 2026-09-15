# Base SAT y RESICO para el V0 — 2026-09-14

## Límite de uso

Este registro guía diseño y pruebas. No determina por sí solo la situación fiscal de una persona ni autoriza presentar declaraciones. Cada cálculo debe guardar la versión de regla y la evidencia aplicada; una persona revisa antes de usarlo fuera de una simulación.

## Registro de fuentes primarias

| Fuente | Recuperada | Aplicabilidad | Hecho útil | Incertidumbre o límite |
|---|---|---|---|---|
| [SAT: formato de factura electrónica, Anexo 20](https://wwwmat.sat.gob.mx/consultas/35025/formato-de-factura-electronica-%28anexo-20%29) | 2026-09-14 | CFDI emitidos/recibidos | CFDI 4.0 es la única versión válida desde 2023-04-01; remite a CFF 29/29-A y reglas RMF | El portal y sus catálogos cambian; registrar versión exacta de XSD/catálogos usada |
| [SAT: verificación de facturas](https://wwwmat.sat.gob.mx/aplicacion/80523/verifica-tus-facturas-electronicas) | 2026-09-14 | Validación individual de CFDI | Permite consultar folio, RFC emisor/receptor y confirmar registro en controles SAT sin autenticación | Consultar estado no valida por sí solo cada regla aritmética o uso fiscal |
| [SAT: servicios especializados de validación](https://wwwmat.sat.gob.mx/consultas/20585/conoce-los-servicios-especializados-de-validacion) | 2026-09-14 | Esquemas, certificados y servicio de consulta | Publica esquemas, cadena original, certificados y documentación del Web Service | Disponibilidad, cuotas y contrato técnico deben verificarse al implementar |
| [SAT: consulta y recuperación de comprobantes](https://wwwmat.sat.gob.mx/consultas/42968/consulta-y-recuperacion-de-comprobantes-%28nuevo%29) | 2026-09-14 | CFDI emitidos/recibidos | Portal: hasta 2,000 XML/día y metadata masiva; e.firma habilita Web Service | Límites pueden cambiar; el portal también admite Contraseña |
| [SAT: manual del servicio de descarga masiva](https://wwwmat.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175779527&ssbinary=true) | 2026-09-14 | Automatización futura | Solicitud, consulta de estado y descarga de paquetes requieren e.firma vigente; el propio manual advierte cuidar datos fuera del equipo | No justifica almacenar e.firma en Wedge; requeriría puente local y nueva revisión de seguridad |
| [SAT: obtén tu e.firma](https://wwwmat.sat.gob.mx/tramites/16703/obten-tu-certificado-de-e.firma) | 2026-09-14 | Identidad y firma | Certificado `.cer`, clave privada `.key`, biometría y vigencia indicada de cuatro años; tiene efectos de firma autógrafa | La custodia de la clave privada y contraseña queda fuera de Wedge V0 |
| [Ley del ISR, texto vigente](https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf) | 2026-09-14 | RESICO PF | 113-E: tope general de 3.5 M, ingreso cobrado amparado por CFDI sin IVA, tabla mensual y pago; 113-J: retención de 1.25% por personas morales | Última reforma mostrada: 2024-04-01; revisar junto con RMF vigente y caso individual |
| [RMF 2026, SAT](https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/rmf/RMF_2026-DOF-28122025.pdf) | 2026-09-14 | Reglas operativas 2026 | Capítulo 3.13: elegibilidad, excepciones, declaración prellenada, e.firma y Buzón | Existen modificaciones y anexos durante el ejercicio; congelar fecha de corte |
| [RMF 2026, DOF](https://dof.gob.mx/2025/SHCP/SHCP_281225_01.pdf) | 2026-09-14 | Publicación oficial | Texto publicado de la Resolución Miscelánea Fiscal 2026 | Comprobar resoluciones modificatorias posteriores antes de cambiar reglas |
| [SAT: pagos mensuales y definitivos](https://wwwmat.sat.gob.mx/declaracion/53359/simulador-de-declaraciones-de-pagos-mensuales-y-definitivos) | 2026-09-14 | Declaración mensual ISR e IVA | Declaración prellenada con CFDI, acceso con RFC/Contraseña o e.firma, acuse y línea de captura | Wedge no puede afirmar “presentado” sin acuse identificable ni “pagado” sin evidencia de pago |

## Reglas mínimas confirmadas

### CFDI

- El V0 recibe CFDI 4.0 por importación manual.
- Debe distinguir cuatro niveles: XML legible, estructura/esquema válido, sellos/timbre técnicamente verificables y estado consultado en SAT.
- Cada nivel se guarda por separado con fecha, método, resultado y error. “Leído” nunca equivale a “vigente en SAT”.
- UUID, RFC de emisor/receptor, tipo, moneda, total, fecha de emisión, fecha de timbrado, método/forma de pago y relaciones son hechos fuente; correcciones preservan el archivo y resultado anterior.

### RESICO persona física

- El artículo 113-E usa ingresos efectivamente cobrados amparados por CFDI, sin IVA, y una tasa mensual según el rango: 1.00%, 1.10%, 1.50%, 2.00% o 2.50%.
- El artículo 113-J establece una retención de ISR de 1.25% cuando una persona moral paga a la persona física RESICO, calculada sobre el pago sin IVA.
- La regla 3.13.7 de RMF 2026 describe la declaración mensual prellenada y el plazo general del día 17 del mes siguiente.
- Elegibilidad no puede reducirse a un booleano calculado sólo por ingresos. Actividades, socios/accionistas, partes relacionadas, residencia y reglas especiales requieren datos y revisión.
- ISR e IVA deben ser motores separados. El simulador actual sólo cubre una parte del ISR mensual.

## Evidencia para estados

| Estado mostrado | Evidencia mínima |
|---|---|
| Importado | Hash, tamaño, tipo, fecha, actor y archivo preservado |
| Estructura válida | Versión de XSD/catálogos y resultado reproducible |
| Timbrado verificado | Cadena/sellos/certificados y resultado técnico |
| Vigente/cancelado SAT | Respuesta de consulta, fecha y parámetros no secretos |
| Cobrado | Movimiento bancario conciliado o confirmación manual explícita con procedencia |
| Estimado | Hechos incluidos, reglas versionadas, operación y advertencias |
| Presentado | Acuse SAT con identificador y periodo |
| Pagado | Línea/obligación enlazada a evidencia de pago conciliada |

## Diferencias con el código actual

| Código actual | Evaluación |
|---|---|
| Tabla mensual y retención | Coinciden con 113-E/113-J para el subconjunto simulado |
| BigInt en centavos | Reproducible, pero la política de redondeo fiscal debe confirmarse y versionarse |
| `RULESET.year = 2026` | Necesita además fecha de corte, vigencia normativa y resolución modificatoria considerada |
| Un solo importe de ingreso y retención | No prueba elegibilidad, origen por CFDI, IVA, devoluciones ni casos especiales |
| Estado de cierre `filed`/`paid` | Es demostración; debe seguir rotulado como simulado hasta existir evidencia SAT/bancaria |

## Próxima revisión fiscal

Antes de habilitar un mes real: confirmar con profesional fiscal la política de redondeo, ingresos por PPD/complementos de pago, notas de crédito/devoluciones, retenciones, IVA por actividad, periodos sin operaciones, elegibilidad y efectos de modificaciones a RMF 2026. Registrar la respuesta como una decisión versionada, no como texto suelto.

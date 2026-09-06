# Lectura de documentos — primera parte de fase 5

Fecha: 2026-09-06. Solo ejemplos sintéticos incluidos en el servidor. No hay subida de archivos propios ni conexión al SAT.

## Resultado usable

En Movimientos → Revisar documentos de ejemplo se puede ejecutar una lectura de seis archivos sintéticos: servicio de agosto, copia idéntica, timbre ausente, servicio de julio, método PPD y contenido diferente bajo el mismo UUID. Los XML se leen realmente con un parser; no se usan resultados preescritos.

Cada cuenta conserva resultados y fecha de lectura. La exportación de Privacidad los incluye y la eliminación borra toda la fila activa. Reiniciar el cierre conserva la lista. Las lecturas no cambian movimientos, importes fiscales ni autorizaciones del cierre.

## Implementación y límites

- Parser XML `@xmldom/xmldom` 0.9.12, añadido como única dependencia directa. Versiones anteriores y metadatos de la instalación conservados en el lockfile.
- Se extraen campos por namespace y parentesco: versión, emisor/receptor, fecha, total, moneda, tipo, método y UUID del timbre.
- Se conservan los decimales como texto; no se suman ni calculan impuestos.
- Se rechazan XML mal formado, DTD/entidades, datos básicos ausentes, fechas imposibles y límites de tamaño/complejidad. Límite del lector: 128 KiB, 2048 aperturas de marcado y profundidad 64. Son límites del producto, no requisitos del SAT.
- Una huella SHA-256 identifica el contenido. Igual UUID y huella significa copia; igual UUID y huella distinta exige revisión. Un cambio de espacios también cambia la huella: no se afirma fraude ni invalidez por esa diferencia.
- Los resultados se guardan con la misma escritura condicional por propietario, versión y revisión del progreso. Máximo seis resultados, determinado por el catálogo cerrado. Las copias no agregan otra fila al listado.
- La API acepta exclusivamente identificadores del catálogo; rechaza XML, rutas y metadatos enviados por clientes. No solicita recursos referenciados por el XML.

Un resultado «Datos leídos» no certifica el CFDI. No se validan XSD completos, catálogos fiscales, certificados, sellos, vigencia, cancelaciones, titularidad del RFC, reglas de impuestos o cobros. Los ejemplos omiten sellos y certificados reales deliberadamente; nunca son facturas válidas. El módulo de lectura requiere más validación y controles antes de admitir archivos externos.

## Fuentes técnicas comprobadas

El esquema oficial CFDI 4.0 identifica el namespace, versión 4.0 y atributos como Fecha, Moneda, Total y TipoDeComprobante. El esquema del Timbre Fiscal Digital 1.1 identifica su namespace, versión y UUID. Se inspeccionaron ambos documentos XML oficiales el 2026-09-06; esa lectura parcial no equivale a implementar todas sus restricciones.

- [Esquema CFDI 4.0, SAT](https://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd)
- [Esquema Timbre Fiscal Digital 1.1, SAT](https://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd)
- [Material de ayuda de facturación, SAT](https://www.sat.gob.mx/minisitio/Factura/emite_materialdeayudaparafactura.htm)
- [Proyecto y API de xmldom](https://github.com/xmldom/xmldom)

## Evidencia y siguiente hito

30 pruebas totales: 19 previas, siete del lector/presentación y cuatro de persistencia/API para documentos. Incluyen namespaces alternativos, datos escapados, entradas maliciosas, duplicados, aislamiento, eliminación y conflictos simultáneos. No hay medición de usabilidad, exactitud fiscal ni rendimiento con archivos reales.

Antes de ingesta real: cerrar condiciones de privacidad, validar fuentes/catálogos completos y casos de referencia, decidir conservación de originales, escaneo y límites de archivos, completar prueba de recuperación y conectar la clasificación documental con revisión fiscal y evidencia de cobro. No confundir «archivo recibido» con «ingreso cobrado».

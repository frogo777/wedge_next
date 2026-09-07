# Movimientos conectados — 2026-09-07

El apartado Movimientos mostraba importes fijos diferentes de los registros guardados que alimentaban Resumen. Ahora consume el mismo monthlyLedger: documentado, cobrado y pendiente del periodo coinciden.

La lista incluye cada folio una vez si el documento se emitió en el mes seleccionado o tiene un cobro registrado para ese mes. Se muestran por separado el mes de emisión, total del archivo, importe/mes del cobro y exclusiones. Los documentos rechazados sin folio se revisan en Documentos. No hay datos de gastos disponibles en el catálogo.

Filtros: todos, cobros válidos del mes, documentos del mes pendientes al cierre, y folios/cobros que necesitan revisión. Los filtros no recalculan los totales generales. Un documento admitido con un cobro incompatible puede aparecer como pendiente y por revisar, hecho indicado en la pantalla.

Se reutilizan las confirmaciones, deshacer y descarga existentes; no se añaden permisos, escrituras, datos personales o reglas fiscales. La pantalla de Pendientes se rotula como parte del cierre de ejemplo. El recorrido de cierre conserva sus cifras ilustrativas y no se presenta como un cierre de estos registros.

Evidencia: cuatro casos nuevos verifican folio único y totales comunes, factura de julio cobrada en agosto, cobro incompatible y estados de carga/vacío/filtro sin resultados. Son 60 pruebas de módulos/API y seis del Worker compilado. El nuevo módulo se comprueba como recurso servido por el Worker.

La revisión visual sigue pendiente por el bloqueo de URL del navegador. No se realizó un nuevo intento de eludir esa restricción. Sigue pendiente verificar filtros, desplazamiento de tabla, teclado y controles en móvil/escritorio mediante un entorno permitido.

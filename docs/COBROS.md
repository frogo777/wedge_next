# Resumen conectado de documentos y cobros

2026-09-06. Incremento de la fase 5, todavía con datos sintéticos.

Resumen es ahora la entrada principal. Lee documentos y confirmaciones guardados por cuenta. El recorrido anterior queda en «Explorar recorrido de cierre con importes fijos»; no se combina con este resumen ni con el simulador fiscal.

- Documentado: total de documentos admitidos del mes de emisión, sin sumar copias del mismo UUID.
- Cobrado: total de confirmaciones cuyo mes de recepción es el seleccionado. Una factura de julio cobrada en agosto aparece documentada en julio y cobrada en agosto.
- Pendiente: importe de documentos emitidos en el mes seleccionado sin confirmación de cobro hasta el cierre de ese mes. No es toda la cartera acumulada.
- Un PUE o PPD no registra automáticamente cobros. Se exige confirmación explícita del importe completo y mes. La demo solo admite julio–septiembre de 2026 y meses de cobro iguales o posteriores al de emisión; anticipos no están implementados.
- El servidor toma importe, folio y huella del documento guardado. El cliente no puede fijar el importe. Repetir la confirmación no duplica dinero; cambiar mes exige deshacer primero.
- Un folio con contenido conflictivo se excluye completo, independientemente del orden de lectura. Si ya tenía cobro confirmado, el registro se conserva y se señala como excluido, sin sumarlo. Se puede deshacer el cobro; resolver versiones del documento queda pendiente.
- Deshacer conserva el documento. RESET conserva documentos y cobros; ERASE elimina la fila completa. La exportación JSON incluye los cobros y el resumen TXT identifica el mes y sus exclusiones.

Los totales incluyen el importe completo leído del XML. No separan IVA, retenciones o base de ISR. No hay reglas fiscales nuevas en esta entrega; tampoco se infiere autenticidad, vigencia SAT, saldo bancario o presentación. El catálogo solo contiene servicios emitidos ficticios: no clasifica automáticamente documentos propios como ingresos/gastos.

## Persistencia y compatibilidad

Migración aditiva `0003_careful_namorita.sql`: añade collections con valor inicial []. Conserva documentos, versión y avance anteriores. Confirmaciones usan el mismo control de versión/revisión y aislamiento de cuenta. No existe bitácora inmutable de correcciones: deshacer retira la confirmación activa. Para datos reales faltan conciliación bancaria, pagos parciales, anticipos, cancelaciones, gastos y bitácora.

## Evidencia

47 pruebas de módulos/API y seis de Worker compilado. Casos: PUE/PPD sin cobro inferido; copia exacta; repetición idempotente; cambio de mes; factura de julio cobrada en agosto; cobro de septiembre que conserva pendiente en agosto; conflicto antes/después del cobro; undo; rechazo de importe inyectado; dos escrituras simultáneas; exportación, borrado y aislamiento. La integración recupera documento y cobro tras reiniciar Miniflare con la misma base aislada.

No se realizó prueba visual en navegador ni con cuentas reales. La CI debe aprobar el commit publicado; su resultado se consulta en GitHub Actions.

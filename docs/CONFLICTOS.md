# Elección de versiones en conflicto

2026-09-07. Incremento de la fase 5; archivos sintéticos exclusivamente.

El problema: dos XML con el mismo folio y distinto contenido excluían indefinidamente el importe del resumen. Ahora Documentos permite comparar total, fecha, emisor y método; confirmar una versión o volver a excluir todo el folio. El registro de lectura original permanece intacto. No se declara que el archivo elegido sea auténtico, vigente o fiscalmente válido.

## Reglas implementadas

La elección solo existe para un grupo con dos huellas distintas. El servidor deriva candidato, folio y huellas de documentos de la cuenta; el cliente solo envía tipo de acción, identificador de ejemplo y versión/revisión del estado. Nunca se acepta un importe, huella o historial enviado por el cliente.

Cada decisión añade tipo, candidato, folio, huella, conjunto de versiones comparadas y fecha del servidor. Repetir la elección vigente no duplica entradas. Cambiarla o volver a excluir añade una entrada nueva. Si aparece una huella distinta de las que se compararon, la elección pierde efecto hasta otra revisión. El conjunto exacto de huellas vincula la decisión a los archivos revisados.

Límite de la demo: 50 decisiones por registro. Al alcanzar el límite se rechazan cambios nuevos, sin borrar ni sobrescribir el historial. No hay borrado individual de entradas. RESET conserva el historial; ERASE elimina el registro completo; exportar datos incluye todas sus decisiones. No es un registro inmutable o certificado frente a administradores/proveedor.

## Coherencia con cobros

Elegir la versión original puede volver a incluir su cobro previo si coinciden folio, huella e importe. Elegir otro total deja el cobro anterior conservado pero excluido y señalado en Resumen. No se lo convierte al nuevo importe. Para sustituirlo hay que deshacer la confirmación y registrar otra explícitamente. Volver a excluir el folio también excluye sus cobros.

El informe TXT identifica la versión y huella usada, y marca un cobro incompatible como excluido. Los totales siguen sin separar impuestos ni calcular obligaciones.

## Verificación y límites

56 pruebas de módulos/API y seis de integración Worker. Nuevos casos: ambos órdenes de lectura y candidatos, idempotencia, cambiar/reabrir, nueva huella, límite del historial, cobro incompatible, escapes de HTML, aislamiento, exportación, eliminación, rechazos de campos inyectados y elecciones simultáneas. La integración guarda una elección y la recupera tras reiniciar el runtime con su base aislada. Migración 0004 aditiva: columna decisions con valor inicial [] para registros anteriores.

No se realizó QA visual ni prueba con cuentas reales. Falta verificar experiencia, conciliación bancaria, cancelaciones, pagos parciales y procedimientos de revisión fiscal. El historial registra decisiones de demostración, no evidencia de un cierre real.

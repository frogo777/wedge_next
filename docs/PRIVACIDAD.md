# Privacidad de la demo — fase 4 en desarrollo

Fecha: 2026-09-06. Documento operativo interno; no es el aviso de privacidad comercial definitivo.

## Inventario comprobado en el código

| Dato | Uso | Ubicación | Eliminación implementada |
|---|---|---|---|
| Identificador de usuario de Sites | Aislar el registro | D1, clave de demo_progress | Se borra junto con la fila |
| Pendientes resueltos y estado de agosto | Continuar la demo | D1 | Se borra junto con la fila |
| Resultados de XML sintéticos, metadatos, huella y fecha | Revisar ejemplos y copias | D1 dentro de demo_progress | Se borran junto con la fila |
| Confirmaciones de cobro sintéticas: folio, huella, importe, mes y fecha de confirmación | Resumen mensual | D1 dentro de demo_progress | Se borran junto con la fila |
| Historial de versiones: selección/exclusión, folio, huellas y fecha | Trazar elecciones en la demo | D1, columna decisions | Se borra junto con la fila |
| XML originales del catálogo sintético procesado | Probar copia y borrado completos | R2 privado; D1 conserva hash, propiedad y recibo | R2 activo se borra antes de la entidad D1 |
| Versión, revisión aleatoria y fecha | Evitar conflictos | D1 | Se borra junto con la fila |
| Nombre/correo desde ChatGPT | Mostrar la cuenta | Solicitud/respuesta y DOM | No se persiste en D1 |
| Movimientos e impuestos ficticios | Ilustrar el recorrido | Código público | No pertenecen a un contribuyente |
| JSON y expediente descargados | Copia solicitada por usuario | Dispositivo del usuario | Fuera del control de Wedge |

No existe carga de RFC, CFDI, e.firma, documentos o datos bancarios aportados por usuarios. Los RFC y datos de los XML de ejemplo son sintéticos; sus resultados sí se guardan por cuenta. El código de Wedge no integra analítica publicitaria ni envía información a modelos. Se quitaron las solicitudes de tipografías a Google; se utilizan fuentes del dispositivo. Esto no implica ausencia de telemetría, cookies o registros de los proveedores de acceso y alojamiento.

Los importes del simulador ISR se procesan en memoria del navegador y no se envían a la API ni se guardan en D1. El TXT que descargue el usuario queda en su dispositivo; no forma parte de la exportación o eliminación del registro de cuenta.

## Núcleo privado activo sólo para el catálogo sintético

El fundador decidió que los originales futuros también se conserven en la nube privada de Wedge y aprobó la política de retención del piloto. [ADR 0002](decisions/0002-private-source-storage.md) prepara D1 para propiedad/auditoría y R2 para bytes: claves sin RFC o nombre de archivo, acceso sólo desde servidor, verificación SHA-256 al leer y borrado activo R2 antes de D1. El máximo preparatorio es 128 KiB por XML y 1,000 fuentes distintas por entidad.

La demo conecta el núcleo al catálogo cerrado incluido en el servidor. Procesar uno de esos ejemplos conserva sus bytes sintéticos en R2 y la [exportación completa](EXPORTACION.md) entrega un ZIP autenticado con progreso, manifiesto y originales verificados, sin revelar claves internas. El borrado de Privacidad alcanza la fila activa, la entidad y esos objetos. No existe carga de archivos externos y Wedge todavía no acepta documentos fiscales reales. La publicación y prueba remota de este incremento siguen pendientes.

## Controles disponibles

La sección Privacidad permite descargar un ZIP del registro actual y los XML sintéticos procesados, y eliminarlos con confirmación de D1/R2 activos. La exportación no pretende incluir datos internos de ChatGPT o Sites. Consultar la API con GET no crea una fila; procesar un XML de ejemplo sí puede crear el registro y su entidad privada. Volver a realizar una acción del recorrido puede crear datos nuevos.

La eliminación está condicionada a la versión y revisión leídas por el usuario. Cada escritura genera una revisión aleatoria: una pestaña que conserva un registro eliminado no puede modificar su reemplazo aunque ambos tengan el mismo número de versión. Una pestaña que nunca tuvo registro puede iniciar un nuevo recorrido; la eliminación no revoca sesiones ni prohíbe crear nuevos registros.

La eliminación no alcanza copias históricas del proveedor, registros de infraestructura, la cuenta de ChatGPT ni descargas locales. No se ha verificado la duración de retención ni la capacidad de purga de esas copias. Tampoco hay eliminación automática por antigüedad en esta versión. El núcleo coordina el borrado de D1 y R2 activos y escribe un tombstone de cero bytes con UUID hasheado para impedir que un restore reactive la entidad. La política aprobada propone retenerlo 45 días, pero el lock/lifecycle administrativo del R2 de Sites sigue pendiente. Esto no permite prometer borrado universal o inmediato de todos los sistemas.

## Requisitos pendientes antes de atender clientes

Conforme a los artículos 14–16 de la LFPDPPP, el aviso debe identificar al responsable y su domicilio, los datos y finalidades, opciones para limitar su uso, mecanismos ARCO y comunicación de cambios. Los artículos 18–20 contemplan seguridad, comunicación de vulneraciones significativas y confidencialidad. Estas obligaciones requieren procesos además de código.

Fuente oficial consultada el 2026-09-06: [LFPDPPP, Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), texto con última reforma indicada del 14-11-2025.

Todavía se necesitan identidad y domicilio del responsable del servicio, canal de privacidad operativo, revisión del aviso, responsabilidades de proveedores, retención por inactividad/cierre antes de beta externa y restauración comprobada. No se inventaron domicilio, correo de soporte, certificaciones o promesas de cumplimiento. La demo sigue privada y sin documentos fiscales reales. La página explicativa no sustituye el aviso completo.

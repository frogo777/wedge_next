# Privacidad de la demo — fase 4 en desarrollo

Fecha: 2026-09-06. Documento operativo interno; no es el aviso de privacidad comercial definitivo.

## Inventario comprobado en el código

| Dato | Uso | Ubicación | Eliminación implementada |
|---|---|---|---|
| Identificador de usuario de Sites | Aislar el registro | D1, clave de demo_progress | Se borra junto con la fila |
| Pendientes resueltos y estado de agosto | Continuar la demo | D1 | Se borra junto con la fila |
| Versión, revisión aleatoria y fecha | Evitar conflictos | D1 | Se borra junto con la fila |
| Nombre/correo desde ChatGPT | Mostrar la cuenta | Solicitud/respuesta y DOM | No se persiste en D1 |
| Movimientos e impuestos ficticios | Ilustrar el recorrido | Código público | No pertenecen a un contribuyente |
| JSON y expediente descargados | Copia solicitada por usuario | Dispositivo del usuario | Fuera del control de Wedge |

No existe carga de RFC, CFDI, e.firma, documentos o datos bancarios reales. El código de Wedge no integra analítica publicitaria ni envía información a modelos. Se quitaron las solicitudes de tipografías a Google; se utilizan fuentes del dispositivo. Esto no implica ausencia de telemetría, cookies o registros de los proveedores de acceso y alojamiento.

## Controles disponibles

La sección Privacidad permite descargar el registro actual de la cuenta autenticada como JSON y eliminarlo, con confirmación, de la base activa. La exportación no pretende incluir datos internos de ChatGPT o Sites. Las lecturas no crean una fila nueva. Volver a realizar una acción del recorrido puede crear una fila nueva.

La eliminación está condicionada a la versión y revisión leídas por el usuario. Cada escritura genera una revisión aleatoria: una pestaña que conserva un registro eliminado no puede modificar su reemplazo aunque ambos tengan el mismo número de versión. Una pestaña que nunca tuvo registro puede iniciar un nuevo recorrido; la eliminación no revoca sesiones ni prohíbe crear nuevos registros.

La eliminación no alcanza copias históricas del proveedor, registros de infraestructura, la cuenta de ChatGPT ni descargas locales. No se ha verificado la duración de retención ni la capacidad de purga de esas copias. Tampoco hay eliminación automática por antigüedad en esta versión. No prometer borrado universal o inmediato de todos los sistemas.

## Requisitos pendientes antes de atender clientes

Conforme a los artículos 14–16 de la LFPDPPP, el aviso debe identificar al responsable y su domicilio, los datos y finalidades, opciones para limitar su uso, mecanismos ARCO y comunicación de cambios. Los artículos 18–20 contemplan seguridad, comunicación de vulneraciones significativas y confidencialidad. Estas obligaciones requieren procesos además de código.

Fuente oficial consultada el 2026-09-06: [LFPDPPP, Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), texto con última reforma indicada del 14-11-2025.

Todavía se necesitan identidad y domicilio del responsable del servicio, canal de privacidad operativo, revisión del aviso, responsabilidades de proveedores, retención definida y restauración comprobada. No se inventaron domicilio, correo de soporte, certificaciones o promesas de cumplimiento. La demo sigue privada y sin documentos fiscales reales. La página explicativa no sustituye el aviso completo.

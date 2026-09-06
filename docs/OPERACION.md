# Operación de la demo y preparación del piloto

Fecha: 2026-09-06. Procedimientos propuestos; no equivalen a una operación de atención ya establecida.

## Fallo de guardado

1. Mostrar el error y detener escrituras hasta recargar el último estado. No anunciar éxito si se perdió la respuesta.
2. Ante conflicto, recuperar el registro actual; no sobrescribirlo ni repetir una autorización automáticamente.
3. Ante indisponibilidad, conservar la versión publicada anterior si aún es compatible. Revisar el estado del proveedor antes de cambiar código.
4. No pedir credenciales de ChatGPT o e.firma para diagnosticar.

## Solicitud de datos o eliminación

La demo usa la identidad autenticada, sin pedir documentos de identificación adicionales. El usuario puede exportar o borrar su fila desde Privacidad. Si aparece conflicto, debe recargar y confirmar sobre el estado actual. Si el resultado de borrado es incierto, recargar o exportar: un registro nulo indica que no existe fila activa en ese momento.

El reinicio conserva una fila; no equivale a eliminación. No registrar el JSON exportado ni la identidad en Git, incidencias públicas o mensajes. Antes del piloto se requiere canal humano, responsable y procedimiento ARCO revisado. El autoservicio de la demo no sustituye ese procedimiento.

## Incidente sospechado

El responsable designado deberá delimitar alcance, contener el acceso afectado y preservar evidencia mínima en un lugar restringido. No borrar registros para ocultar el incidente. Evaluar con apoyo competente las comunicaciones necesarias según hechos y obligaciones aplicables. Este documento no autoriza enviar mensajes ni modificar accesos de terceros.

## Respaldos y recuperación

No hay ejercicio de restauración verificado. Antes de recibir datos reales: comprobar capacidades y retención del proveedor, restaurar datos sintéticos en un entorno separado y medir pérdida máxima y tiempo de recuperación. Toda restauración debe considerar eliminaciones previas para evitar reactivar datos borrados. No prometer RPO/RTO ni un protocolo 3-2-1 implementado.

## Condiciones para abrir un piloto

| Condición | Estado |
|---|---|
| Aislamiento y conflictos de API | Probado con identidades sintéticas y SQLite |
| Exportación y eliminación del registro activo | Probado técnicamente |
| Inicio/cierre de sesión y recarga en dispositivos reales | Pendiente |
| Responsable, canal de atención y aviso definitivo | Pendiente |
| Retención y prueba de restauración | Pendiente |
| Motor fiscal revisado por profesional | No implementado |
| Acuerdos de alcance, precio y cancelación | Pendiente |

Estas condiciones no deben interpretarse como una fecha de lanzamiento. El costo por usuario, tiempo de resolución y retención solo se puntuarán al medirlos.

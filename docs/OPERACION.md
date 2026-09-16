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

El núcleo de originales genera `manifest.json` y entrega cada XML verificado por separado. El consumidor debe escribir en una ubicación temporal y publicar la copia sólo cuando termine toda la iteración; cualquier error obliga a descartar la salida parcial. Aún no existe una ruta de descarga. Cuando se añada, deberá exigir identidad del servidor, impedir caché, usar un nombre neutro y advertir que el archivo contiene información sensible.

## Incidente sospechado

El responsable designado deberá delimitar alcance, contener el acceso afectado y preservar evidencia mínima en un lugar restringido. No borrar registros para ocultar el incidente. Evaluar con apoyo competente las comunicaciones necesarias según hechos y obligaciones aplicables. Este documento no autoriza enviar mensajes ni modificar accesos de terceros.

## Respaldos y recuperación

La auditoría preparatoria de almacenamiento compara D1/R2 con autorización previa, paginación y verificación SHA-256 opcional. Pruebas sintéticas demuestran que detecta objetos faltantes, alterados y huérfanos, además de distinguir intentos pendientes. Esto diagnostica consistencia; no restaura datos.

No hay ejercicio de restauración remota verificado. El núcleo de borrado ya deja un tombstone mínimo en R2 antes de eliminar originales y D1; si no puede registrarlo, mantiene la entidad bloqueada para reintento. El reconciliador offline conserva entidades sin tombstone y elimina las revividas junto con cualquier objeto bajo su prefijo. Su coordinador procesa de 1 a 100 entidades por página y devuelve un cursor; ante un fallo, se reintenta la misma página antes de avanzar. Antes de recibir datos reales: seguir el [runbook R2](runbooks/R2-DELETION-POLICY.md), restaurar datos sintéticos en un entorno separado y medir pérdida máxima y tiempo de recuperación. No ejecutar D1 Time Travel directamente sobre una base que atiende usuarios: sobrescribe el estado y puede reactivar metadatos borrados. Toda restauración debe reconciliar eliminaciones previas y R2 antes de servir. No prometer RPO/RTO ni un protocolo 3-2-1 implementado. Ver [investigación de retención/recuperación](research/RETENTION-RECOVERY-2026-09-14.md) y [ADR 0003](decisions/0003-restore-safe-deletion-registry.md).

## Condiciones para abrir un piloto

| Condición | Estado |
|---|---|
| Aislamiento y conflictos de API | Probado con identidades sintéticas y SQLite |
| Exportación y eliminación del registro activo | Probado técnicamente |
| Exportación de originales privados | ZIP publicado en Site privado; prueba controlada desde sesión real pendiente |
| Inicio/cierre de sesión y recarga en dispositivos reales | Pendiente |
| Responsable, canal de atención y aviso definitivo | Pendiente |
| Retención y prueba de restauración | Política, tombstone y reconciliador probados; lock y restore remoto pendientes |
| Motor fiscal revisado por profesional | No implementado |
| Acuerdos de alcance, precio y cancelación | Pendiente |

Estas condiciones no deben interpretarse como una fecha de lanzamiento. El costo por usuario, tiempo de resolución y retención solo se puntuarán al medirlos.

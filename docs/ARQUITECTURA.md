# Arquitectura de Wedge

## Fase 3: demo autenticada con persistencia

Fecha: 2026-09-06. Repositorio nuevo, sin importar la base anterior.

La interfaz de la fase 2 se conserva como HTML/CSS y módulos JavaScript. Vinext compila un Worker para Sites con una ruta de página y una API. La migración a servidor incorpora únicamente identidad y progreso persistente; los importes siguen siendo constantes ficticias.

### Identidad y acceso

Sites proporciona `oai-authenticated-user-id` detrás de su despachador autenticado. Esa identidad determina el propietario en todas las consultas; el cliente no puede enviar un propietario alternativo. El nombre o correo solo se usa para mostrar la cuenta, sin almacenarlo en D1. Las rutas de inicio/cierre de sesión pertenecen a la plataforma. El sitio mantiene acceso privado del fundador.

Esta confianza no es portátil a un Worker público directo: antes de salir de Sites se necesita un proveedor de autenticación y verificación de sesión propios. No hay todavía operadores, organizaciones ni roles comerciales.

### Almacenamiento y conflictos

D1 guarda una fila por usuario: identificador, estado del cierre de agosto ficticio, pendientes resueltos, versión y fecha de actualización. Drizzle mantiene el esquema y genera SQL versionado. No se ejecuta creación de tablas en cada solicitud.

La API recibe eventos, nunca un estado fiscal arbitrario. Usa consultas preparadas filtradas por usuario, aplica la máquina de estados y realiza escritura condicional por versión. Una operación concurrente o antigua recibe 409 y obliga a recargar. Un fallo de red no provoca reintentos automáticos de una escritura cuyo resultado se desconoce.

### Controles implementados

- Autenticación exigida para leer y escribir progreso.
- Respuestas privadas sin caché; CSP de página y protección contra interpretación de tipos.
- Escrituras JSON, origen de la misma aplicación y cuerpo real limitado a 1024 bytes.
- Validación estricta de eventos y del orden del cierre.
- Texto del perfil y errores insertados con APIs DOM seguras.
- Errores técnicos genéricos, sin registrar cabeceras o datos de cuenta.

Las pruebas no constituyen auditoría de seguridad. Falta evaluar abuso y cuotas, recuperación y eliminación de cuentas, respaldos/restauración y políticas de retención. Reiniciar la demo restablece el recorrido; no elimina la fila de cuenta.

## Límites para evolución

La lógica fiscal futura será determinista y versionada, separada de asistencia por IA. Toda aprobación o presentación real requerirá actor, periodo, fecha y evidencia verificable. Los datos actuales no alimentan modelos. Antes de recibir documentos reales se debe completar privacidad, permisos de operadores y revisión fiscal profesional.

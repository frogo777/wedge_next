# Arquitectura de Wedge

## Fase 3: demo autenticada con persistencia

Fecha: 2026-09-06. Repositorio nuevo, sin importar la base anterior.

La interfaz de la fase 2 se conserva como HTML/CSS y módulos JavaScript. Vinext compila un Worker para Sites con una ruta de página y una API. La migración a servidor incorpora únicamente identidad y progreso persistente; los importes siguen siendo constantes ficticias.

### Identidad y acceso

Sites proporciona `oai-authenticated-user-id` detrás de su despachador autenticado. Esa identidad determina el propietario en todas las consultas; el cliente no puede enviar un propietario alternativo. El nombre o correo solo se usa para mostrar la cuenta, sin almacenarlo en D1. Las rutas de inicio/cierre de sesión pertenecen a la plataforma. El sitio mantiene acceso privado del fundador.

Esta confianza no es portátil a un Worker público directo: antes de salir de Sites se necesita un proveedor de autenticación y verificación de sesión propios. No hay todavía operadores, organizaciones ni roles comerciales.

### Almacenamiento y conflictos

D1 guarda una fila por usuario: identificador, estado del cierre de agosto ficticio, pendientes resueltos, versión, revisión aleatoria y fecha de actualización. Drizzle mantiene el esquema y genera SQL versionado. No se ejecuta creación de tablas en cada solicitud.

La API recibe eventos, nunca un estado fiscal arbitrario. Usa consultas preparadas filtradas por usuario, aplica la máquina de estados y realiza escritura condicional por versión y revisión. Una operación concurrente o antigua recibe 409 y obliga a recargar. Un fallo de red no provoca reintentos automáticos de una escritura cuyo resultado se desconoce.

### Núcleo de originales privados, sin ruta

La evolución preparatoria separa datos estructurados en D1 y bytes originales en el binding privado R2 `BUCKET`. Un intento se registra antes de la carga; la finalización enlaza hash, recibo y auditoría. La lectura vuelve a calcular SHA-256. El borrado bloquea acceso, elimina R2 y después aplica la cascada D1; ambos fallos son reintentables. Las claves de objeto sólo contienen UUID y hash.

Este módulo no está conectado a la API ni desplegado. No recibe documentos reales y no modifica el inventario de la demo. [ADR 0002](decisions/0002-private-source-storage.md) detalla cuotas, concurrencia, costos y las condiciones de retención/restauración pendientes.

### Controles implementados

- Autenticación exigida para leer y escribir progreso.
- Respuestas privadas sin caché; CSP de página y protección contra interpretación de tipos.
- Escrituras JSON, origen de la misma aplicación y cuerpo real limitado a 1024 bytes.
- Validación estricta de eventos y del orden del cierre.
- Texto del perfil y errores insertados con APIs DOM seguras.
- Errores técnicos genéricos, sin registrar cabeceras o datos de cuenta.

Las pruebas no constituyen auditoría de seguridad. Falta evaluar abuso y cuotas, recuperación y eliminación de cuentas, respaldos/restauración y políticas de retención. Reiniciar la demo restablece el recorrido; Privacidad permite exportar o eliminar la fila de cuenta. La revisión aleatoria impide reutilizar una versión antigua después de recrear un registro.

## Límites para evolución

La lógica fiscal futura será determinista y versionada, separada de asistencia por IA. Toda aprobación o presentación real requerirá actor, periodo, fecha y evidencia verificable. Los datos actuales no alimentan modelos. Antes de recibir documentos reales se debe completar privacidad, permisos de operadores y revisión fiscal profesional.

## Lectura documental de ejemplo

El módulo packages/documents/read-cfdi.mjs extrae metadatos de XML sintéticos del catálogo cerrado del servidor. ADD_DOCUMENT solo admite un identificador conocido. Los resultados se guardan en documents, dentro de la misma fila por cuenta; toda escritura mantiene versión y revisión condicional. Se exportan y eliminan con el resto del registro. El parser no calcula impuestos ni confirma autenticidad o cobro. Ver DOCUMENTOS.md para límites y fuentes.

## Simulación ISR

Módulo puro `public/fiscal/resico-isr.mjs`, reexportado desde `packages/fiscal/index.mjs`: una sola fuente para navegador y pruebas Node. BigInt conserva exactitud decimal; resultados identifican regla y fuente. El simulador usa memoria de la página y no envía entradas al backend. No se integra automáticamente al cierre ficticio, documentos o autorizaciones.

# ADR 0002 — Originales en almacenamiento privado de Wedge

Fecha: 2026-09-14. Estado: aceptada por el fundador e implementada de forma preparatoria con datos sintéticos; sin ruta de carga, migración remota ni despliegue.

## Decisión

Los originales se conservarán también en la nube privada de Wedge. D1 guarda propiedad, procedencia, estados y auditoría; R2 guarda únicamente los bytes. El binding lógico `BUCKET` sólo se usa desde el Worker y esta etapa no publica URLs ni rutas de descarga.

```text
identidad autenticada
        │
        ▼
D1: intento ──► R2: bytes + checksum ──► D1: fuente + recibo + auditoría
        │                   │
        └──── reintento ◄───┘  si una etapa falla

borrado: marcar en D1 ──► borrar R2 ──► borrar entidad D1 por cascada
```

Las claves de objeto tienen la forma `entities/{uuid}/sources/{sha256}`. No incluyen RFC, nombre, correo ni nombre de archivo. El contenido admitido por este núcleo es `application/xml`, entre 1 byte y 128 KiB. Se permiten como máximo 1,000 fuentes distintas por entidad: 125 MiB (aprox. 0.122 GiB) de originales antes de cualquier margen operativo.

## Invariantes y fallos

1. La identidad procede del contexto autenticado del servidor. D1 vuelve a comprobar la membresía dentro de cada operación; conocer una entidad o una huella no concede acceso.
2. El hash SHA-256 se calcula sobre una copia de los bytes. R2 recibe ese checksum y cada lectura vuelve a comprobar tamaño y hash contra D1.
3. Antes de escribir en R2 se persiste un intento. Si R2 o la transacción final falla, el intento permite reintentar sin perder atribución. Repetir el mismo comando y los mismos bytes devuelve el recibo original; otros bytes producen conflicto.
4. La creación condicional evita reemplazar silenciosamente un objeto existente. Un objeto previo debe coincidir en tamaño y metadatos de formato.
5. Una eliminación impide nuevas lecturas o cargas, marca los objetos, los borra en grupos de hasta 1,000 y sólo después elimina D1. Un fallo de R2 conserva el estado `deleting` para reintento. Una carga que pierde la carrera con el borrado elimina el objeto tardío.
6. La exportación de dominio muestra procedencia, estado e intentos pendientes, pero no revela claves internas de R2. La lectura de bytes sigue siendo una función exclusiva del servidor.
7. La migración es aditiva: crea `source_objects`, `source_upload_attempts` y `entity_deletions`. No reconstruye las tablas previas ni convierte automáticamente fuentes históricas `metadata_only` en objetos.

Los errores del proveedor y de SQL se traducen a códigos de dominio sin exponer detalles. Las pruebas usan dos identidades y XML sintético; no demuestran seguridad operacional ni cumplimiento legal.

## Retención y puesta en servicio

No hay eliminación automática por antigüedad ni política aprobada para respaldos. Por eso el repositorio permanece desconectado de rutas HTTP y no debe recibir documentos reales. Antes de habilitarlo se debe:

- aprobar el periodo de retención y el comportamiento al cerrar una cuenta;
- verificar qué copias y respaldos administra Sites/Cloudflare y cuánto tardan en purgarse;
- probar restauración y evitar que ésta reactive datos ya borrados;
- añadir ruta autenticada, validación completa de archivo, cuotas por tiempo y registro operativo;
- completar el aviso de privacidad y el canal de derechos de los titulares.

La política del piloto, aprobada por el fundador el 2026-09-14, y su evidencia están en [Retención y recuperación de originales](../research/RETENTION-RECOVERY-2026-09-14.md). No se configura bucket lock: impediría el borrado activo que este módulo promete y Wedge no tiene una base legal aprobada para retener contra una solicitud.

La eliminación implementada cubre la base y el bucket activos del módulo. No cubre descargas del usuario, registros de infraestructura ni respaldos del proveedor.

## Capacidad y costo

R2 Standard publica un nivel mensual sin cargo de 10 GB-mes, un millón de operaciones clase A y diez millones clase B. Fuera de ese nivel, la tarifa publicada es USD 0.015 por GB-mes, USD 4.50 por millón de operaciones clase A y USD 0.36 por millón de clase B; la salida a Internet y los borrados se publican sin cargo. Son precios del proveedor, no una promesa de costo de Sites, y deben revisarse antes de desplegar. Esta rama no aprovisiona ni factura un recurso remoto.

Fuentes oficiales consultadas el 2026-09-14: [precios de R2](https://developers.cloudflare.com/r2/pricing/) y [API de R2 para Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/). La semántica transaccional y de claves foráneas usada por D1 se apoya en [D1 `batch()`](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) y [claves foráneas de D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

## Alternativas descartadas

- **Sólo dispositivo local:** el fundador eligió conservar también los originales en la nube para poder recuperarlos y trabajar entre dispositivos.
- **Bytes dentro de D1:** mezcla objetos con datos estructurados y complica límites, lectura y borrado. R2 es el recurso de objetos previsto por Sites.
- **Rehacer `source_artifacts`:** una reconstrucción con claves foráneas activas podía aplicar cascadas sobre datos existentes. Las tablas aditivas conservan la migración anterior y separan estado del objeto.

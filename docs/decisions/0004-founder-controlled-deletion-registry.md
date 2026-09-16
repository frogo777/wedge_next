# ADR 0004 — Registro de borrados en R2 controlado por el fundador

Fecha: 2026-09-15. Estado: **aprobada e implementada localmente; activación remota pendiente**.

## Problema

Sites administra el R2 real expuesto como `BUCKET` y no entrega operaciones administrativas del bucket. La cuenta Cloudflare conectada no contiene ese recurso y, al volver a comprobarla, R2 respondió que requiere activar una suscripción. Por eso Wedge no puede aplicar ni demostrar el lock y lifecycle definidos en [ADR 0003](0003-restore-safe-deletion-registry.md) sobre el registro actual.

## Decisión

Mantener en Sites la aplicación, la identidad, D1 y los originales sintéticos. Mover únicamente los tombstones a un bucket R2 separado, propiedad de la cuenta Cloudflare del fundador, mediante la API S3 firmada desde el Worker de Sites.

```text
                         ┌─► Sites D1 + BUCKET ─► datos y originales activos
Wedge privado en Sites ──┤
                         └─► R2 del fundador ───► deletions/v1/*
                                                  lock 45 d + lifecycle 45 d
```

La aplicación usa un modo explícito y cuatro variables de runtime: ID de cuenta, nombre del bucket, Access Key ID y Secret Access Key. Las dos credenciales se guardan como secretos de Sites. El token R2 debe tener sólo lectura y escritura de objetos y limitarse al bucket del registro. La administración de locks y lifecycle usa una credencial distinta; la aplicación no la recibe.

## Comportamiento

- El alta sigue siendo condicional (`If-None-Match: *`) e idempotente.
- El objeto conserva cero bytes, `application/octet-stream`, `Cache-Control: no-store` y `x-amz-meta-format: wedge-deletion-v1`.
- La URL sólo contiene la huella SHA-256; nunca el UUID de la entidad o la identidad de la cuenta.
- Si la configuración externa está completa, el borrado exige ese registro antes de eliminar originales y D1.
- El modo de producción `s3` exige las cuatro variables y falla cerrado si falta cualquiera. Sin modo ni variables se usa el binding local existente para desarrollo y para no romper el Site mientras se aprovisiona el bucket.
- El reconciliador acepta el registro separado; los originales restaurados siguen borrándose desde `BUCKET`.

## Consecuencias

La migración evita reemplazar la identidad de Sites o mover toda la aplicación. Añade una dependencia de red durante el borrado y una credencial S3 acotada. Si el R2 externo no responde, la entidad queda bloqueada en `deleting` y conserva sus originales para reintento; no se confirma un borrado incompleto.

La activación de R2 puede requerir checkout aunque el piloto quede dentro del nivel gratuito. Antes de datos reales se debe completar el aprovisionamiento remoto, aplicar ambas reglas, guardar secretos en Sites, desplegar y ejecutar el simulacro aislado. La implementación no convierte la infraestructura pendiente en cumplimiento verificado.

Fuentes oficiales consultadas el 2026-09-15: [inicio de R2](https://developers.cloudflare.com/r2/get-started/), [compatibilidad S3](https://developers.cloudflare.com/r2/api/s3/api/), [aws4fetch](https://developers.cloudflare.com/r2/examples/aws/aws4fetch/), [bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/), [lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) y [precios](https://developers.cloudflare.com/r2/pricing/).

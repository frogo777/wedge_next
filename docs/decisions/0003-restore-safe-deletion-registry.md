# ADR 0003 — Registro de borrados resistente a restauraciones

Fecha: 2026-09-14. Estado: **aprobada por el fundador e implementada localmente con datos sintéticos**. No configura locks, lifecycle, recursos remotos ni credenciales.

## Problema

D1 Time Travel restaura la base en el mismo lugar. Si se vuelve a un punto anterior a una eliminación, reaparecen la entidad, su membresía y los metadatos; R2 ya no contiene los originales, pero Wedge podría volver a servir información que había confirmado como borrada.

```text
t0 entidad activa ── t1 borrado ── t2 estado actual
        ▲
        └──── restore a t0 ──► entidad reaparece

registro fuera de D1 ───────► detectar y volver a borrar antes de servir
```

Cloudflare documenta que Time Travel está siempre activo, conserva hasta 7 días en Workers Free o 30 días en Paid y que un restore sobrescribe D1 y cancela consultas en curso. R2 ofrece consistencia fuerte para escribir, leer, listar y borrar. Sus bucket locks pueden limitarse a un prefijo y prevalecen sobre lifecycle; lifecycle puede retirar objetos por edad, normalmente dentro de las 24 horas posteriores al vencimiento.

Fuentes oficiales consultadas el 2026-09-14: [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [consistencia de R2](https://developers.cloudflare.com/r2/reference/consistency/), [bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/), [lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [API R2 para Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) y [precios R2](https://developers.cloudflare.com/r2/pricing/).

## Opciones

| Opción | Ventaja | Costo/riesgo | Evaluación |
|---|---|---|---|
| Tombstone mínimo en el R2 actual, bajo prefijo bloqueado 45 días | Independiente del restore D1; usa el binding existente; ningún original duplicado | Retiene un identificador pseudónimo temporal; requiere configurar lock/lifecycle | **Recomendada** |
| Segunda base D1 | Consultas sencillas | Nuevo binding/recurso fuera del manifiesto Sites actual; también puede restaurarse o alterarse | Complejidad sin mejor garantía |
| Tombstone R2 indefinido | Cubre respaldos futuros desconocidos | Retención permanente sin necesidad demostrada | Descartada para el piloto |
| Sin registro | Cero datos adicionales | Puede reactivar datos borrados | Inaceptable antes de restores |

## Política aprobada para el piloto

Por cada entidad que entra en `deleting`, escribir antes del borrado final un objeto de cero bytes:

```text
deletions/v1/{sha256("wedge:deletion:v1:" + entity_uuid)}
```

- No guarda UUID, usuario, RFC, correo, actor, nombre de archivo ni bytes fiscales.
- Usa creación condicional; repetir la eliminación conserva el mismo objeto.
- Si no puede escribirse o validarse, la entidad permanece bloqueada en `deleting` y el borrado se reintenta.
- El prefijo `deletions/v1/` se bloquea por 45 días (3,888,000 segundos) y recibe lifecycle a 45 días. El prefijo de originales `entities/` permanece sin lock.
- Los 45 días cubren el máximo documentado de 30 días de Time Travel más 15 días de margen. Si Wedge incorpora backups con mayor retención, deberá ampliar esta ventana antes de usarlos.
- Tras un restore, las escrituras siguen cerradas. Un reconciliador calcula la misma huella para cada entidad restaurada y elimina coincidencias antes de volver a servir la base.
- El registro no se muestra por HTTP y no se utiliza para analítica, perfilado o reconstrucción de documentos.

## Costo y límite operativo

Cada eliminación añade un `PutObject` y al menos un `ListObjects`, ambos clase A; cada página adicional suma otro listado. Validar un tombstone existente usa una lectura clase B y los borrados no tienen cargo de operación. R2 Standard incluye actualmente 10 GB-mes, un millón de operaciones clase A y diez millones clase B al mes. El piloto debería caber holgadamente, pero el nivel gratuito se comparte con el resto de la cuenta y no constituye una promesa de costo cero.

Configurar el lock requiere acceso administrativo al bucket. La excepción ya fue aprobada; la aplicación Sites está activa, pero su manifiesto sólo expone el binding lógico `BUCKET` y no el nombre administrativo del bucket ni sus reglas. El CLI local de Cloudflare tampoco tiene una sesión autenticada. El [runbook de nube](../runbooks/R2-DELETION-POLICY.md) define el cambio exacto sin confundir el nombre local de Miniflare con el recurso remoto.

## Decisión aprobada

El fundador aprobó: **conservar durante 45 días, en el R2 privado existente, un tombstone de cero bytes cuyo nombre sea la huella SHA-256 del UUID aleatorio de la entidad; aplicar lock y lifecycle sólo al prefijo `deletions/v1/`.**

La implementación marca primero la entidad como `deleting`, escribe el tombstone con creación condicional y checksum, y sólo entonces elimina todos los objetos del prefijo de la entidad y D1. Un fallo conserva la entidad bloqueada y reintentable. La consulta de recuperación valida que el objeto tenga cero bytes, formato y cabeceras esperadas; el reconciliador offline elimina entidades restauradas y objetos huérfanos antes de reabrir escrituras. El coordinador recorre D1 por páginas acotadas y permite reintentos idempotentes. Estas funciones permanecen aisladas de HTTP. Falta comprobar lock/lifecycle y el proceso completo en un recurso remoto sintético.

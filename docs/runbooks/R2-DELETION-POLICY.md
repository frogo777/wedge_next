# Runbook — política R2 para borrados resistentes a restore

Fecha: 2026-09-15. Alcance aprobado: sólo el prefijo `deletions/v1/` de un bucket R2 propiedad de la cuenta Cloudflare del fundador. No aplicar estas reglas al binding Sites `BUCKET` ni a `entities/`.

## Resultado del intento remoto — 2026-09-15

La conexión Cloudflare autorizada no administra la infraestructura del Site publicado. La comprobación devolvió cero Workers en esa cuenta y la API de R2 indicó que R2 no está habilitado. En paralelo, Sites confirmó que Wedge sigue activo como versión privada 12 y sólo expone a la aplicación el binding lógico `BUCKET`. Por tanto, el bucket del Site está fuera del alcance administrativo de la cuenta Cloudflare conectada.

No se creó un segundo bucket, no se modificó ninguna regla y no se escribió ningún objeto de prueba. Un bucket nuevo en la cuenta conectada no protegería el binding que usa producción.

```text
Wedge publicado ──► Sites ──► BUCKET administrado por el proveedor
                              ╳ sin API administrativa disponible

Cloudflare conectado ──► 0 Workers; R2 no habilitado
```

La salida seleccionada en [ADR 0004](../decisions/0004-founder-controlled-deletion-registry.md) separa sólo el registro de borrados. Wedge conserva Sites y escribe los tombstones por S3 en un R2 controlado. La cuenta conectada sigue respondiendo `10042: Please enable R2 through the Cloudflare Dashboard`; no se ha creado todavía el bucket.

```text
desbloqueo: activar R2 → crear bucket → lock + lifecycle → token acotado
            → secretos Sites → desplegar → prueba sintética → restore aislado
```

## Cambio exacto

| Regla | Prefijo | Acción | Edad |
|---|---|---|---:|
| `wedge-deletion-tombstones-45d` | `deletions/v1/` | Bucket lock | 45 días / 3,888,000 s |
| `wedge-expire-deletion-tombstones-45d` | `deletions/v1/` | Eliminar por lifecycle | 45 días / 3,888,000 s |

Cloudflare documenta que los locks aplican a objetos nuevos y existentes, que la regla de retención más estricta prevalece y que lifecycle suele retirar un objeto dentro de las 24 horas posteriores al vencimiento. Fuentes: [bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/), [lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [API de locks](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/locks/) y [API de lifecycle](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/).

## Preflight obligatorio

1. Activar la suscripción R2 en la cuenta Cloudflare del fundador. Revisar el checkout: el nivel gratuito no elimina la posibilidad de cobro por uso excedente.
2. Crear un bucket Standard dedicado al registro. No hacerlo público y no habilitar `r2.dev`.
3. Usar una sesión o token limitado a editar la configuración R2 de ese bucket. No guardar tokens, secretos o salidas de autenticación en Git.
4. Crear por separado una credencial S3 con `Object Read & Write`, limitada exclusivamente a ese bucket. La aplicación no necesita permiso para editar buckets o reglas.
5. Enumerar y conservar las reglas existentes:

```text
npx wrangler r2 bucket lock list <BUCKET_REAL>
npx wrangler r2 bucket lifecycle list <BUCKET_REAL>
```

No usar `lock set` o `lifecycle set` con un archivo parcial: esas operaciones reemplazan la configuración completa. Los comandos `add` siguientes agregan una regla sin descartar las demás.

## Aplicación

Aplicar primero el lock y después lifecycle. No usar `--force`: revisar la confirmación que muestra Wrangler.

```text
npx wrangler r2 bucket lock add <BUCKET_REAL> wedge-deletion-tombstones-45d deletions/v1/ --retention-days 45
npx wrangler r2 bucket lifecycle add <BUCKET_REAL> wedge-expire-deletion-tombstones-45d deletions/v1/ --expire-days 45
```

Si el bucket tiene jurisdicción restringida, añadir `--jurisdiction <JURISDICCION>` a todos los comandos. Si falla lifecycle después de crear el lock, dejar el lock activo y reintentar lifecycle; así el registro queda protegido aunque aún no expire automáticamente.

## Conexión con Sites

Guardar en Sites y marcar como secretos los dos valores de credencial:

| Variable | Secreta | Valor |
|---|---:|---|
| `WEDGE_DELETION_REGISTRY_MODE` | No | `s3` |
| `WEDGE_DELETION_R2_ACCOUNT_ID` | No | ID de la cuenta Cloudflare |
| `WEDGE_DELETION_R2_BUCKET` | No | bucket dedicado |
| `WEDGE_DELETION_R2_ACCESS_KEY_ID` | Sí | Access Key ID limitado |
| `WEDGE_DELETION_R2_SECRET_ACCESS_KEY` | Sí | Secret Access Key limitado |

Desplegar una versión guardada después de cambiar el entorno. El modo `s3` bloquea la eliminación si falta cualquier valor; nunca se debe dejar una mezcla parcial en producción.

## Verificación remota sintética

1. Volver a listar ambas configuraciones y comprobar ID, prefijo, estado habilitado y 45 días.
2. Crear a través de Wedge una entidad totalmente sintética y eliminarla. Comprobar que aparece exactamente un objeto de cero bytes bajo `deletions/v1/`, sin UUID, usuario u otro dato.
3. Comprobar que ese objeto no puede sobrescribirse ni borrarse mientras el lock está vigente.
4. Crear y borrar un objeto sintético en el bucket de originales del Site; debe borrarse para demostrar que el lock externo no alcanzó originales.
5. Guardar sólo conteos, resultado y fecha en `docs/ESTADO.md`; no guardar credenciales, nombres administrativos ni respuestas completas del proveedor.
6. No esperar 45 días en una ejecución. La parte de lifecycle se valida por configuración; registrar la eliminación efectiva en una revisión posterior.

## Restore D1

No ejecutar Time Travel sobre la base que atiende la aplicación. En un entorno sintético aislado:

1. detener escrituras;
2. restaurar D1;
3. ejecutar `reconcileRestoredEntityDeletionsPage` hasta que `nextCursor` sea `null`;
4. repetir la última página si hubo un error;
5. comprobar que no quedan entidades revividas ni objetos bajo sus prefijos;
6. reabrir escrituras sólo después de revisar los conteos.

La prueba local cubre paginación, reintentos y objetos huérfanos. La prueba remota queda bloqueada hasta activar R2, conectar el registro externo y disponer de un D1 sintético aislado.

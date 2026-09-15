# Runbook — política R2 para borrados resistentes a restore

Fecha: 2026-09-14. Alcance aprobado: sólo el prefijo `deletions/v1/` del bucket privado usado por el binding Sites `BUCKET`. No aplicar estas reglas a `entities/`.

## Resultado del intento remoto — 2026-09-15

La conexión Cloudflare autorizada no administra la infraestructura del Site publicado. La comprobación devolvió cero Workers en esa cuenta y la API de R2 indicó que R2 no está habilitado. En paralelo, Sites confirmó que Wedge sigue activo como versión privada 11 y sólo expone a la aplicación el binding lógico `BUCKET`. Por tanto, el bucket del Site está fuera del alcance administrativo de la cuenta Cloudflare conectada.

No se creó un segundo bucket, no se modificó ninguna regla y no se escribió ningún objeto de prueba. Un bucket nuevo en la cuenta conectada no protegería el binding que usa producción.

```text
Wedge publicado ──► Sites ──► BUCKET administrado por el proveedor
                              ╳ sin API administrativa disponible

Cloudflare conectado ──► 0 Workers; R2 no habilitado
```

Para continuar, Sites debe exponer la administración del R2 que respalda `BUCKET`, o Wedge debe migrar explícitamente a un Worker y un R2 controlados por el fundador. Esa migración es un cambio de infraestructura separado; este runbook no debe ejecutarse contra otro bucket.

## Cambio exacto

| Regla | Prefijo | Acción | Edad |
|---|---|---|---:|
| `wedge-deletion-tombstones-45d` | `deletions/v1/` | Bucket lock | 45 días / 3,888,000 s |
| `wedge-expire-deletion-tombstones-45d` | `deletions/v1/` | Eliminar por lifecycle | 45 días / 3,888,000 s |

Cloudflare documenta que los locks aplican a objetos nuevos y existentes, que la regla de retención más estricta prevalece y que lifecycle suele retirar un objeto dentro de las 24 horas posteriores al vencimiento. Fuentes: [bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/), [lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [API de locks](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/locks/) y [API de lifecycle](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/).

## Preflight obligatorio

1. Obtener del propietario de Sites acceso administrativo al bucket **real** y su jurisdicción. `site-creator-r2` en `vite.config.ts` es únicamente el nombre local de Miniflare.
2. Usar una sesión o token limitado a editar la configuración R2 de ese bucket. No guardar el token, ID de cuenta o salida de autenticación en Git.
3. Enumerar y conservar las reglas existentes:

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

## Verificación remota sintética

1. Volver a listar ambas configuraciones y comprobar ID, prefijo, estado habilitado y 45 días.
2. Crear un objeto sintético de cero bytes bajo `deletions/v1/`, sin UUID, usuario u otro dato. Comprobar que no puede sobrescribirse ni borrarse.
3. Crear y borrar un objeto sintético bajo `entities/synthetic-policy-probe/`; debe borrarse para demostrar que el lock no alcanzó originales.
4. Guardar sólo conteos, resultado y fecha en `docs/ESTADO.md`; no guardar credenciales, nombres administrativos ni respuestas completas del proveedor.
5. No esperar 45 días en una ejecución. La parte de lifecycle se valida por configuración; registrar la eliminación efectiva en una revisión posterior.

## Restore D1

No ejecutar Time Travel sobre la base que atiende la aplicación. En un entorno sintético aislado:

1. detener escrituras;
2. restaurar D1;
3. ejecutar `reconcileRestoredEntityDeletionsPage` hasta que `nextCursor` sea `null`;
4. repetir la última página si hubo un error;
5. comprobar que no quedan entidades revividas ni objetos bajo sus prefijos;
6. reabrir escrituras sólo después de revisar los conteos.

La prueba local cubre paginación, reintentos y objetos huérfanos. La prueba remota queda bloqueada hasta que Sites exponga el bucket administrativo o exista una conexión Cloudflare con acceso a ese recurso.

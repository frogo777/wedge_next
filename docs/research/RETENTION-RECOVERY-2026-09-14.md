# Retención y recuperación de originales — 2026-09-14

Estado: recomendación para el piloto privado; pendiente de decisión del fundador y revisión jurídica antes de datos reales. No configura retención, backups ni recursos remotos.

## Evidencia oficial

| Fuente | Hecho relevante | Consecuencia para Wedge |
|---|---|---|
| [CFF vigente, artículo 30](https://portalhcd.diputados.gob.mx/LeyesBiblio/PortalWeb/Leyes/Vigentes/MOV/Codigo_Fiscal_de_la_Federacion.pdf) | Quienes están obligados a llevar contabilidad deben conservarla y, como regla general, la documentación relacionada durante cinco años; existen supuestos con cómputos o plazos distintos. | El fundador puede tener su propio deber de conservación. Esto no demuestra que Wedge deba impedirle borrar una copia alojada; requiere revisión fiscal/jurídica. |
| [LFPDPPP vigente, artículos 24–25](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf) | La persona titular puede solicitar cancelación; procede bloqueo antes de supresión y hay excepciones cuando el tratamiento es necesario por contrato, disposición u obligación legal. | Wedge necesita una base y plazo documentados para cualquier retención posterior a la solicitud. Hoy no existen; no se debe inventar una excepción. |
| [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) | La recuperación a un punto en el tiempo está siempre activa; el historial es de hasta 7 días en Workers Free y 30 en Paid. El restore actual sobrescribe la base y cancela consultas en curso. | No usar un restore directo como rutina: podría reactivar metadatos borrados y desalinearlos de R2. El plan exacto de Sites debe verificarse tras aprovisionar un entorno sintético. |
| [Durabilidad de R2](https://developers.cloudflare.com/r2/reference/durability/) | Cloudflare publica once nueves de durabilidad, pero aclara que esto no evita el borrado intencional o accidental. | La redundancia del proveedor reduce fallos físicos; no sustituye un backup ni recupera una eliminación. |
| [Consistencia de R2](https://developers.cloudflare.com/r2/reference/consistency/) | Lecturas, escrituras, listados y borrados por binding son fuertemente consistentes. | Una auditoría puede comparar D1 y R2 sin esperar propagación del bucket privado. |
| [Bucket locks de R2](https://developers.cloudflare.com/r2/buckets/bucket-locks/) | Un lock impide borrar o reemplazar objetos hasta vencer; la regla más estricta prevalece sobre lifecycle. | No activarlo para originales del usuario sin base legal y producto aprobados: puede impedir una cancelación solicitada. |
| [Lifecycle de R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) | Puede expirar objetos por edad; normalmente se eliminan dentro de 24 horas del vencimiento. | No configurar una caducidad global: la fecha fiscal relevante no coincide necesariamente con la fecha de carga. |

## Tensión que debe resolver el producto

```text
conservar evidencia fiscal ───────┐
                                 ├─ política explícita + exportación + revisión jurídica
minimizar y cancelar datos ──────┘

durabilidad R2 ≠ backup ≠ retención legal
```

La obligación fiscal puede recaer en el contribuyente; la responsabilidad de Wedge depende del servicio, contratos y aviso. Por eso no se traduce automáticamente «cinco años» en un lock de bucket de cinco años.

## Recomendación para el piloto del fundador

| Tema | Política recomendada |
|---|---|
| Mientras la entidad esté activa | Conservar originales hasta que el fundador elimine la fuente, entidad o cuenta. Sin expiración automática durante el piloto privado. |
| Solicitud explícita de eliminación | Bloquear lectura/carga de inmediato; borrar R2 activo y después D1 activo, con reintentos hasta concluir. |
| Copia de recuperación de originales | No crear una segunda copia oculta durante el piloto. El fundador conserva su fuente y Wedge debe ofrecer una exportación completa antes de ingesta real. |
| Bucket lock | Desactivado para originales. Revisarlo sólo si una obligación concreta exige inmutabilidad y se diseña una excepción de cancelación válida. |
| D1 Time Travel | Tratarlo como historial del proveedor, no como copia lista para servir. Ningún restore en producción sin reconciliar eliminaciones y objetos. |
| Inactividad/cierre comercial | Definir antes de beta externa. Propuesta inicial: aviso previo y ventana de exportación; el plazo requiere decisión de producto y revisión legal. |
| Responsabilidad fiscal del usuario | Explicar que borrar en Wedge no elimina su posible deber de conservar documentación y darle una exportación utilizable. |

Esta opción mantiene utilidad para un solo fundador, evita costo/retención duplicada y conserva el derecho técnico de borrar. Su límite es explícito: un original borrado accidentalmente de R2 no se puede recuperar desde Wedge.

## Protocolo de recuperación propuesto

1. Detener escrituras del módulo afectado y conservar evidencia mínima del incidente.
2. Obtener una copia/exportación para análisis; no ejecutar Time Travel directamente sobre la base que atiende usuarios.
3. Comparar D1 y R2 con la auditoría acotada del dominio: faltantes, huérfanos, tamaño, metadatos y, cuando se solicite, SHA-256 real.
4. Reconciliar solicitudes de eliminación anteriores antes de volver a servir cualquier dato restaurado. Wedge todavía no tiene un registro de borrados independiente del D1 restaurado; éste es un gate de despliegue.
5. Restaurar sólo datos sintéticos en un ambiente aislado y medir pérdida/tiempo. La capacidad actual de Sites para clonar o exponer el recurso debe comprobarse sin asumir acceso directo de Wrangler.
6. Reabrir escrituras sólo con conteos consistentes y una revisión humana del alcance.

La auditoría añadida es de sólo lectura, autoriza en D1 antes de listar R2, pagina hasta 2,000 objetos y no devuelve bytes. La verificación completa hace una lectura por objeto; debe ser una operación manual porque consume operaciones clase B y no reemplaza observabilidad continua. D1 y R2 no ofrecen una instantánea transaccional conjunta: si hay escrituras durante el recorrido, el informe puede marcar un cambio concurrente y debe repetirse.

## Decisión requerida

Recomendación a aprobar: **durante el piloto privado, conservar mientras la entidad esté activa; borrar D1/R2 activos cuando el fundador lo solicite; no usar bucket lock ni una segunda copia de originales; exigir exportación y copia propia antes de uso real.**

Antes de beta externa todavía se debe fijar el plazo por inactividad/cierre, la política para backups del proveedor, el responsable/canal de privacidad y el registro de borrados resistente a una restauración.

# ADR 0001 — Entidad y procedencia antes de cargar archivos

Fecha: 2026-09-14. Estado: implementación preparatoria con datos sintéticos; sin activar rutas ni desplegar migraciones.

## Problema y decisión

La fila JSON de la demo pertenece a una cuenta de acceso. No representa un contribuyente ni permite demostrar de forma independiente quién incorporó una fuente. Se añaden tablas de dominio separadas, sin convertir los datos de la demo en hechos financieros.

```text
Identidad Sites → membresía owner → entidad
                                     ├─ fuente (SHA-256 de bytes)
                                     ├─ recepción (comando → fuente)
                                     └─ auditoría (actor → comando)
```

La entidad sólo guarda ID y fecha. No se almacena RFC, nombre fiscal, credenciales ni roles de colaboración. La identidad sigue siendo la proporcionada por el servidor detrás de Sites; este módulo no autentica cabeceras ni puede usarse como API directa. Tener un ID de entidad no concede permiso.

Se utiliza `import_receipts` por archivo/comando, en lugar de anticipar un lote con múltiples estados todavía inexistentes. Un lote futuro coordinará varias recepciones sin cambiar sus fuentes ni actores. La procedencia normalizada y los asientos siguen fuera de esta primera migración.

## Invariantes comprobables

1. Las consultas y escrituras de entidades existentes incluyen membresía por usuario y entidad. El contexto de actor se construirá en el servidor, nunca desde el cuerpo HTTP.
2. Claves compuestas `(entity_id, hash)` impiden que una recepción señale la fuente de otra entidad. El mismo archivo en entidades distintas no comparte filas.
3. SHA-256 se calcula sobre una copia de los bytes originales, antes de cualquier normalización. El llamador no suministra el hash. Máximo 128 KiB por fuente en esta etapa.
4. Una clave de comando se limita a una entidad. Repetirla con el mismo hash devuelve la recepción original; reutilizarla con otros bytes produce conflicto. Una segunda recepción con nueva clave conserva el intento y reutiliza la fuente.
5. Fuente, recepción y evento se escriben en un `D1.batch`. Un fallo revierte las tres. La membresía se comprueba dentro de las sentencias; no se usa una autorización leída y almacenada en caché.
6. Exportación lee entidad, fuentes, recepciones y eventos en un único batch. Conserva actor, tiempo, hash y versión del formato. Ausencia y falta de permiso producen el mismo error de dominio.
7. No hay operación para editar fuentes, recepciones o eventos. La bitácora es append-only en la interfaz del repositorio, no resistente a un administrador de D1. No se promete evidencia criptográfica de integridad de toda la base.
8. El borrado de una entidad elimina sus filas activas por cascada, incluida la bitácora. Se autoriza en la propia sentencia y no afecta otras entidades. Esto no elimina backups o descargas.

## Alcance deliberado de esta migración

Las fuentes tienen estado explícito `metadata_only`: se conserva hash/tamaño, **no el original**. Una recepción no significa CFDI válido, conciliación, asiento, declaración ni pago. No se incluyen saldos, reglas fiscales, estimaciones o hipótesis de IA.

El módulo queda sin rutas de aplicación hasta implementar almacenamiento del original, cuotas, retención, exportación/borrado conjuntos y revisión del acceso. La privacidad actual de la demo sigue describiendo sólo `demo_progress`. Las pruebas usan exclusivamente identidades y bytes sintéticos.

## Consultas e índices

- Acceso: clave primaria membresía `(entity_id, user_id)`.
- Deduplicación: clave primaria fuente `(entity_id, sha256)`.
- Idempotencia: clave primaria recepción `(entity_id, command_id)`.
- Exportación: prefijo `entity_id` de cada clave primaria, con orden estable por clave.
- Auditoría: clave primaria `(entity_id, event_id)`; eventos referencian la recepción mediante clave compuesta.

No se añaden índices para consultas aún inexistentes. Las pruebas inspeccionan el plan de acceso y la integridad referencial además de resultados.

## Validación y reversión

Generar SQL aditivo con Drizzle y probarlo sobre una base temporal con todas las migraciones anteriores y una fila sintética de demo. Verificar aislamiento A/B, duplicados concurrentes, rollback de un fallo de bitácora, exportación, borrado y rechazo de referencias cruzadas. Una copia temporal prueba la reversión eliminando sólo las tablas nuevas en orden inverso; las migraciones históricas permanecen intactas. En una base con datos reales la reversión requeriría respaldo y plan de recuperación, no ejecutar ese fixture.

## Evidencia técnica

[D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) documenta reversión de la secuencia al fallar una sentencia. [Claves foráneas D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/) documenta su aplicación y las acciones de cascada. Consultadas el 2026-09-14; se comprueba el comportamiento también con Miniflare. La protección por membresía es una decisión de Wedge y no una garantía automática de D1.

## Frontera pendiente

Antes de habilitar originales: acordar retención y alcance de borrado del piloto, verificar backups del proveedor y configurar almacenamiento privado. No migrar a documentos reales sólo porque las pruebas sintéticas pasen. La arquitectura de identidad y el almacenamiento de RFC requieren revisión específica antes del piloto.

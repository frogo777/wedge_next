# Backlog de ingeniería

Ordenado por riesgo y capacidad de aprender. Cada tarea debe terminar con comandos y evidencia en `docs/ESTADO.md`.

## WDG-001 — actualizar dependencias vulnerables

**Estado: completada el 2026-09-14.** Next/eslint-config-next 16.3.5; React/React DOM/React Server DOM 19.2.8; transitivas corregidas y auditoría de producción en cero. El artefacto, 60 pruebas unitarias, 6 de Worker y lint quedaron verificados.

- **Meta / valor:** retirar avisos críticos corregibles antes de procesar datos sensibles.
- **Incluye:** Next y `eslint-config-next` a una versión parcheada compatible; lockfile; auditoría y regresión completa.
- **Fuera:** actualizaciones generales o rediseño.
- **Dependencias:** ninguna.
- **Aceptación:** build, 60 pruebas unitarias, 6 de integración y lint pasan; producción no reporta avisos críticos/altos con corrección disponible.
- **Pruebas:** `npm audit --omit=dev`, unitarias, build, integración y lint.
- **Seguridad:** revisar advisory y cambio de dependencias transitivas; no ejecutar scripts de instalación no confiables.

## WDG-002 — hacer obligatorio el typecheck

**Estado: completada el 2026-09-14.** Runtime Cloudflare tipado, binding `DB` declarado, script portable y puerta de CI; `npm run typecheck` pasa.

- **Meta / valor:** impedir que tipos incompatibles del Worker lleguen a `main`.
- **Incluye:** tipos oficiales Cloudflare/Sites, script portable `typecheck` y paso CI.
- **Fuera:** migrar JavaScript de interfaz a TypeScript.
- **Dependencias:** WDG-001.
- **Aceptación:** `npm run typecheck` pasa limpio en Node soportado y CI lo ejecuta.
- **Pruebas:** fallo intencional en rama local demuestra que la puerta detecta tipos inválidos; restaurar antes de commit.
- **Seguridad:** tipar bindings y ambiente para evitar acceso a recursos equivocados.

## WDG-002A — actualizar el toolchain vulnerable

**Estado: iniciada el 2026-09-14.** Vite subió de 8.0.13 a 8.3.0 y cerró sus avisos directos. El resto requiere actualizar de forma coordinada Cloudflare/Vinext/Miniflare/Drizzle.

- **Meta / valor:** reducir riesgo en desarrollo y CI sin desestabilizar el runtime de Sites.
- **Incluye:** Vite, plugin Cloudflare, Wrangler y transitivas con parches compatibles; evaluar Vinext y React Server DOM por separado.
- **Fuera:** aceptar una versión beta mayor de Vinext o bajar Drizzle sólo para silenciar auditoría.
- **Dependencias:** WDG-002 y matriz de compatibilidad del starter Sites.
- **Aceptación:** auditoría completa sin avisos altos corregibles o cada excepción documentada con alcance/fecha; mismas rutas y pruebas pasan.
- **Pruebas:** instalación limpia, typecheck, unitarias, build, integración y servidor local aislado.
- **Seguridad:** no abrir el servidor de desarrollo a redes no confiables; revisar advisories antes de cada cambio directo.

## WDG-003 — entidad fiscal, procedencia y auditoría

- **Meta / valor:** aislar cada contribuyente y explicar cada cambio.
- **Incluye:** ADR/invariantes, migraciones aditivas para entity/membership/import/artifact/audit; repositorios transaccionales.
- **Fuera:** migrar la demo JSON o aceptar datos reales.
- **Dependencias:** WDG-002 y revisión del modelo V0.
- **Aceptación:** ninguna consulta de dominio funciona sin `entity_id` autorizado; hash y actor sobreviven exportación; migración reversible en copia sintética.
- **Pruebas:** aislamiento A/B, concurrencia, idempotencia, migración desde base actual y bitácora append-only.
- **Seguridad:** RFC protegido, mínimos datos, redacción de logs y autorización en servidor.

## WDG-004 — importación manual segura de CFDI

- **Meta / valor:** reemplazar el catálogo cerrado por un flujo útil sin conectar SAT.
- **Incluye:** lote, límites, cuarentena, hash, parsing CFDI 4.0, resultados parciales y archivos sintéticos/adversariales.
- **Fuera:** e.firma, descarga masiva y CFDI 3.x.
- **Dependencias:** WDG-003, retención definida y almacenamiento de objetos configurado.
- **Aceptación:** duplicados son idempotentes; un archivo malo no pierde los buenos; UI distingue leído/estructura/timbre/estado SAT.
- **Pruebas:** XXE/DTD, profundidad, tamaño, encoding, MIME, zip bomb si se admite ZIP, UUID duplicado/conflictivo y aislamiento.
- **Seguridad:** análisis sin ejecución, cuotas, nombres no confiables y borrado coherente del original.

## WDG-005 — validación técnica y estado SAT

- **Meta / valor:** evitar que “XML leído” se interprete como factura válida/vigente.
- **Incluye:** XSD/catálogos versionados, cadena/sellos/timbre y adaptador de consulta de estado con caché temporal.
- **Fuera:** certificación PAC y emisión/cancelación.
- **Dependencias:** WDG-004 y revisión de documentación SAT vigente.
- **Aceptación:** cada nivel produce evidencia independiente; indisponibilidad SAT queda como desconocido; cambios de estado conservan historia.
- **Pruebas:** certificados/firmas sintéticos válidos e inválidos, respuestas SAT grabadas sin datos personales, timeout y reintentos idempotentes.
- **Seguridad:** SSRF bloqueado mediante endpoint fijo, límites, timeouts y sin credenciales SAT.

## WDG-006 — movimientos y conciliación

- **Meta / valor:** determinar cobros desde evidencia y reducir confirmaciones manuales.
- **Incluye:** un formato CSV, cuenta, movimiento inmutable, propuestas exactas/toleradas y confirmación/rechazo.
- **Fuera:** escritura bancaria, agregadores múltiples y pagos parciales complejos.
- **Dependencias:** WDG-003 y política de moneda/redondeo.
- **Aceptación:** reimportar no duplica; cada match explica monto/fecha/referencia; ningún match automático ambiguo se confirma solo.
- **Pruebas:** duplicados, signos, zonas horarias, moneda, empate, cobro fuera de periodo y CSV hostil.
- **Seguridad:** sólo lectura, fórmula CSV neutralizada en exportaciones y números de cuenta minimizados.

## WDG-007 — libro de doble partida mínimo

- **Meta / valor:** producir estados consistentes y correcciones trazables.
- **Incluye:** cuentas, asientos, partidas, borrador/publicación/reverso y reglas de contabilización para casos V0.
- **Fuera:** inventario, nómina, depreciación y contabilidad multi-moneda avanzada.
- **Dependencias:** WDG-003 y WDG-006; revisión contable profesional de plantillas.
- **Aceptación:** todo asiento publicado balancea por moneda; una corrección revierte, nunca sobrescribe; se puede recorrer hasta CFDI/movimiento.
- **Pruebas:** propiedades de balance, idempotencia, reversos, periodos cerrados y concurrencia.
- **Seguridad:** sólo comandos autorizados publican; bitácora no editable.

## WDG-008 — estimación RESICO explicable

- **Meta / valor:** calcular el mes desde hechos reales y mostrar de dónde sale cada cifra.
- **Incluye:** ruleset versionado, selección de cobros elegibles, retenciones, desglose y exportación.
- **Fuera:** determinación integral de elegibilidad, IVA final, declaración y pago.
- **Dependencias:** WDG-005 a WDG-007 y revisión fiscal de casos.
- **Aceptación:** mismo conjunto + ruleset produce mismo resultado; cada renglón enlaza hechos y fuente normativa; cambios invalidan estimaciones previas.
- **Pruebas:** fronteras de tasa, centavos/redondeo aprobado, retención, cancelaciones, notas y periodos.
- **Seguridad:** lenguaje de estimación, sin estado presentado/pagado y sin datos en logs.

## WDG-009 — privacidad, recuperación y piloto fundador

- **Meta / valor:** operar un mes de forma segura y medir si Wedge ahorra trabajo.
- **Incluye:** retención, exportación/borrado integral, backup/restore sintético, incidentes, QA móvil y tres cierres observados.
- **Fuera:** lanzamiento público.
- **Dependencias:** WDG-003 a WDG-008.
- **Aceptación:** restore dentro del objetivo acordado; borrado cubre D1/objetos/backups según política; métricas del V0 registradas sin datos sensibles.
- **Pruebas:** simulacro de pérdida, solicitud de acceso/borrado, dos cuentas reales controladas por el fundador y recorrido móvil.
- **Seguridad:** mínimo privilegio, registro de operadores, plan de incidentes y consentimiento informado.

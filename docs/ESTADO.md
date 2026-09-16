# Estado de Wedge

Fecha canónica: 2026-09-15. Proyecto desde cero en `frogo777/wedge_next`. El historial de incrementos anteriores se conserva debajo.

## Estado actual — 2026-09-15

**Incremento WDG-009D:** la demo enlaza cada cuenta con una entidad privada al procesar el catálogo cerrado, conserva esos XML sintéticos en R2 y ofrece una descarga ZIP autenticada con progreso, manifiesto y originales verificados. El ZIP se transmite sin acumular la exportación completa en memoria y sólo escribe su directorio final al concluir; un fallo deja una descarga inválida. El borrado de Privacidad alcanza ahora progreso, entidad y objetos R2 activos antes de confirmar. No existe carga de archivos propios.

Verificación local WDG-009D: `npm run verify` pasa con typecheck, 67 pruebas unitarias, build y 36 de integración (103 en total). Los casos nuevos cubren ZIP y rutas seguras, entidad única bajo concurrencia, reintento, autenticación/origen, almacenamiento R2, descarga repetida y borrado D1/R2 con tombstone. Lint pasa y la auditoría de producción reporta cero vulnerabilidades. La migración 0007 es aditiva y crea sólo el enlace uno-a-uno de la demo. Publicación y prueba remota pendientes.

**Incremento WDG-009C ([PR #7](https://github.com/frogo777/wedge_next/pull/7)):** el fundador aprobó [ADR 0003](decisions/0003-restore-safe-deletion-registry.md). El borrado marca D1, registra en R2 un tombstone de cero bytes y UUID hasheado, y después elimina objetos y entidad. Fallos conservan `deleting`; reintentos validan el tombstone existente. Un reconciliador offline paginado detecta entidades revividas y elimina también objetos huérfanos. El lock/lifecycle de 45 días sigue limitado al prefijo `deletions/v1/`, pero no pudo configurarse en nube porque el R2 de Sites no pertenece a la cuenta Cloudflare conectada; el [runbook](runbooks/R2-DELETION-POLICY.md) fija el cambio, la verificación y el desbloqueo requerido.

Verificación local WDG-009C: `npm run verify` pasa con typecheck, 65 pruebas unitarias, build y 34 de integración (99 en total). Veintiocho pruebas corresponden al dominio D1/R2 y seis al Worker. Los casos nuevos cubren fallo del registro, reintento, minimización, restore D1 sintético, paginación acotada y tombstone alterado.

Verificación remota WDG-009C: el commit `9cc8395` pasó [CI Windows/Ubuntu](https://github.com/frogo777/wedge_next/actions/runs/34938921175) y se publicó como versión privada 11 de [Wedge en Sites](https://wedge-next.hola192112.chatgpt.site). Sites aplicó las migraciones aditivas: D1 expone las nueve tablas esperadas y las ocho tablas del dominio nuevo permanecen vacías. El repositorio de dominio no tiene ruta HTTP y su código inactivo no entra al bundle. No se cargaron datos fiscales. El 2026-09-15, Sites confirmó el Site activo mientras la conexión Cloudflare mostró cero Workers y R2 no habilitado en su propia cuenta. No se modificaron reglas ni se crearon objetos o recursos. El lock/lifecycle remoto requiere que Sites exponga el bucket administrativo o una migración aprobada a infraestructura propia.

**Incremento WDG-009B:** núcleo de [exportación completa](EXPORTACION.md) para nube privada. Produce un manifiesto versionado y después entrega cada XML almacenado de forma incremental. Cada original se vuelve a autorizar y se verifica por tamaño y SHA-256 después de leer R2; una revocación, borrado concurrente, fuente histórica sin bytes o intento pendiente aborta la exportación.

Verificación local WDG-009B: `npm run verify` pasa con typecheck, 65 pruebas unitarias, build y 30 de integración (95 en total). Veinticuatro pruebas corresponden al dominio D1/R2 y seis al Worker. No añade dependencias, rutas, recursos remotos ni datos reales.

**Incremento WDG-009A:** auditoría de consistencia D1/R2 de sólo lectura y [recomendación de retención/recuperación](research/RETENTION-RECOVERY-2026-09-14.md). Autoriza antes de listar y antes de responder, pagina de forma acotada y permite verificar el SHA-256 real. Distingue sano, trabajo pendiente, faltante, alterado, huérfano, conflicto de seguimiento y cambio concurrente sin devolver bytes.

El fundador aprobó conservar mientras la entidad esté activa y borrar D1/R2 activos cuando lo solicite, sin bucket lock ni segunda copia oculta. Antes de datos reales todavía faltan la ruta autenticada de descarga, un registro de borrados resistente a restores y un simulacro remoto aislado. D1 Time Travel y la durabilidad de R2 no se presentan como backup recuperable del original.

Verificación WDG-009A: `npm run verify` pasa con typecheck, 65 pruebas unitarias, build y 26 de integración (91 en total). Veinte pruebas corresponden al dominio D1/R2 y seis al Worker.

**Base WDG-004B:** el fundador eligió conservar los originales también en la nube privada de Wedge. [ADR 0002](decisions/0002-private-source-storage.md) prepara R2 para bytes y D1 para propiedad, intentos, estado y auditoría. Incluye hash verificado al leer, creación condicional, reintentos D1–R2–D1, límite de 128 KiB y 1,000 fuentes distintas por entidad, y borrado R2 antes de la cascada D1.

En ese corte el módulo seguía sin ruta HTTP, despliegue, documentos reales o política automática de retención. La migración 0006 es sólo aditiva: una reconstrucción generada durante el desarrollo se descartó antes de guardarla porque las cascadas de D1 podían eliminar fuentes existentes. La prueba de migración conserva expresamente una fuente `metadata_only` previa.

Verificación local WDG-004B: `npm run verify` pasa con typecheck, 65 pruebas unitarias, build y 22 de integración (87 en total). `npm run db:generate` confirma que no quedan cambios de esquema. Lint: cero errores y el aviso histórico de la plantilla. Auditoría completa: cero avisos altos/críticos y cuatro moderados ya documentados de la cadena Drizzle. El helper de build del plugin Sites 0.1.70 no alcanza el build en Windows porque busca `node_modules/npm`; el comando portátil sí compila correctamente.

```text
Fundamentos y dependencias   ✓ PR #1; CI Windows + Ubuntu pasa
Procedencia por entidad      ✓ PR #2; núcleo D1 preparado
Lectura XML adversarial      ✓ PR #3; CI Windows + Ubuntu pasa
Originales de archivos       △ ZIP sintético listo; archivos externos cerrados
Auditoría de almacenamiento  ✓ faltantes/alteración/huérfanos detectados localmente
Retención del piloto         ✓ política aprobada; revisión jurídica antes de datos reales
Registro contra restores     △ esquema remoto vacío; política R2 bloqueada por Sites
Flujo financiero real        ○ todavía no habilitado
```

[PR #1](https://github.com/frogo777/wedge_next/pull/1): auditoría, dependencias y comandos portátiles. [CI remoto](https://github.com/frogo777/wedge_next/actions/runs/34929443677) pasó en Windows y Ubuntu para `e8a028b`: tipos, lint, auditoría completa, 60 pruebas unitarias, build y 6 pruebas de Worker. Cero avisos altos/críticos; cuatro moderados de la cadena Drizzle documentados.

[PR #2](https://github.com/frogo777/wedge_next/pull/2) prepara entidad/procedencia; [PR #3](https://github.com/frogo777/wedge_next/pull/3) endurece XML; [PR #4](https://github.com/frogo777/wedge_next/pull/4) prepara los originales privados; [PR #5](https://github.com/frogo777/wedge_next/pull/5) añade auditoría D1/R2 y registra la política de retención aprobada; [PR #6](https://github.com/frogo777/wedge_next/pull/6) añade la exportación completa; [PR #7](https://github.com/frogo777/wedge_next/pull/7) evita que un restore reactive entidades borradas. Los seis permanecen como borradores apilados antes de integrar; el estado completo de #7 ya se publicó en el Site privado sin abrir rutas del dominio.

Las dieciséis pruebas de WDG-004B cubren aislamiento, referencias cruzadas, reintento concurrente y posterior, actualización de recibos anteriores a R2, conflicto de comando, fallos de auditoría/R2, manipulación de bytes, carrera carga–borrado, borrado reintentable, cuotas y migración/reversión. WDG-009A añade cuatro pruebas de auditoría y WDG-009B cuatro de exportación completa. El manifiesto no filtra claves internas del bucket. Los originales sólo salen por la función de servidor, de uno en uno y con autorización posterior a la lectura de R2.

**Siguiente:** publicar y validar una copia sintética controlada en Sites. Después, obtener control administrativo del R2 de Sites o aprobar una migración a infraestructura Cloudflare propia para configurar/probar lock, lifecycle y recuperación remota. Los archivos externos permanecen cerrados hasta completar esas pruebas y los controles de ingesta. La bitácora sólo es append-only a través de la interfaz de repositorio; un administrador de D1 mantiene capacidad de modificar la base. La identidad sigue dependiendo del despachador Sites.

## Historial — auditoría de fundamentos del 2026-09-14

Los controles y métricas siguientes describen cortes anteriores; el estado vigente está arriba.

### Actualización WDG-002A — revisión posterior

Plugin Cloudflare 1.49.0, Wrangler 4.116.0, Miniflare 4.20260730.0 y tipos 5.20260730.1. Se preserva Vinext 0.0.50 con image-size 2.0.4; Miniflare utiliza sharp 0.35.4 y undici 7.29.0. El árbol completo ahora reporta cero avisos altos/críticos y cuatro moderados de una sola cadena de Drizzle, con excepción y revisión fechada en `docs/security/DEPENDENCIES.md`.

`npm run verify` funciona directamente en Windows: typecheck, 60 pruebas unitarias, build y seis pruebas de Worker/D1. Lint: cero errores y un aviso histórico. Desarrollo local devuelve 302 en `/`, 401 en API anónima y 200 en `app.mjs`; escucha en loopback. CI añade lint y auditoría completa, con matriz Windows/Ubuntu; sus resultados remotos deben comprobarse por separado.

Se corrige el alcance del informe anterior: `npm audit --omit=dev` no certifica el contenido del Worker. Los resultados inferiores de 17 avisos y el bloqueo Bash son históricos, anteriores a este incremento.

Auditoría completa del repositorio, arquitectura, base de datos, documentación, proyectos abiertos, mercado, SAT/RESICO, amenazas, modelo V0 y backlog. El dictamen mantiene a Wedge como demo privada: todavía no recibe archivos de usuarios, no es libro contable y no presenta o paga obligaciones.

```text
Auditoría y decisiones        ██████████  completa
Dependencias de producción    ██████████  0 avisos auditados
Typecheck obligatorio         ██████████  pasa y corre en CI
Núcleo de datos V0            ██░░░░░░░░  diseñado, sin migración
Validación con usuarios       ░░░░░░░░░░  pendiente
```

### Cambio implementado

- Next y `eslint-config-next`: 16.2.6 → 16.3.5.
- React, React DOM y React Server DOM: 19.2.6 → 19.2.8; este último sí aparece dentro del Worker compilado.
- Vite: 8.0.13 → 8.3.0.
- Transitivas vulnerables: `fast-uri` → 3.1.7 y `baseline-browser-mapping` → 2.11.23.
- Tipos del runtime Cloudflare alineados a 4.20260515.1; binding `DB` declarado.
- `npm run typecheck` y paso obligatorio de CI añadidos.
- Sin migración de datos, despliegue o uso de información real.

### Evidencia reproducida desde instalación limpia

| Comprobación | Resultado |
|---|---:|
| `npm ci --ignore-scripts --no-audit --no-fund` | Pasa |
| `npm run typecheck` | Pasa |
| `npm run test:unit` | 60/60 |
| `npx vinext build` | Pasa; rutas `/` y `/api/progress` |
| `node --test tests/integration/worker.test.mjs` | 6/6 |
| ESLint | 0 errores; 1 aviso preexistente en `page-template.mjs` |
| `npm audit --omit=dev` | 0 vulnerabilidades reportadas |
| `npm audit` completo | 11 altas, 5 moderadas, 1 baja en toolchain/dev |

El wrapper de compilación del plugin Sites no pudo resolver el npm global en este Windows; la compilación directa de Vinext sí pasó. `npm run verify` sigue dependiendo de Bash y está registrado como portabilidad pendiente.

### Documentos canónicos

- `docs/audit/FOUNDATION-2026-09-14.md`
- `docs/research/OPEN-SOURCE-2026-09-14.md`
- `docs/research/MARKET-2026-09-14.md`
- `docs/tax/SAT-RESICO-2026.md`
- `docs/security/THREAT-MODEL-2026-09-14.md`
- `docs/product/V0-FOUNDATION.md`
- `docs/BACKLOG.md`

### Próxima tarea

WDG-002A: actualizar en un cambio separado el toolchain Vite/Vinext/Cloudflare y volver a probar compatibilidad. Después, WDG-003 convierte entidad fiscal, procedencia y auditoría en una decisión de arquitectura y migraciones aditivas; antes de crear tablas se revisarán aislamiento, retención, precisión monetaria e invariantes del libro.

## Fases 3 y 4 — acceso y privacidad de la demo

Acceso mediante identidad de ChatGPT en Sites, progreso de agosto persistente por cuenta en D1, cierre de sesión, conflictos entre pestañas y recuperación de errores sin sobrescritura silenciosa. Se conserva el recorrido visual de la fase 2. Migración SQL versionada y salida de compilación separada del código fuente.

El alcance es una demo privada. No hay motor fiscal integral, SAT, pagos reales, documentos de contribuyentes ni contratación comercial. La verificación del despliegue se registra en Sites; este documento describe el código y sus límites.

## Evidencia

37 pruebas automatizadas de lógica/API: seis del recorrido, diecisiete de acceso/privacidad/documentos y siete del lector/presentación y siete de cálculo/presentación, aislamiento A/B, entradas adulteradas, origen y tamaño del cuerpo, escritura concurrente, versiones antiguas, guardado/lectura y ausencia de almacenamiento. La API se prueba con SQLite y un adaptador de D1. Compilación del Worker verificada. Las identidades de las pruebas son sintéticas.

Pendiente: QA visual, inicio/cierre de sesión con cuentas reales y recuperación entre dispositivos. La fase 3 no se declara validada con usuarios. El sitio seguirá privado mientras se completa esta validación y la fase de privacidad.

## Evaluación

Escala: 0 ausente; 2 definido; 4 implementado; 6 probado técnicamente; 8 validado con usuarios; 10 operación sostenida. No expresa probabilidad de éxito ni certificación.

| Dimensión | Fase 2 /10 | Fase 3 /10 | Evidencia |
|---|---:|---:|---|
| Recorrido de demostración | 6 | 6 | Máquina de estados probada |
| Persistencia por cuenta | 0 | 6 | Guardado y aislamiento en pruebas de API |
| Control de concurrencia | 0 | 6 | Conflictos de versión detectados |
| Interfaz y móvil | 4 | 4 | Implementación sin QA visual |
| Validación con usuarios | 0 | 0 | Sin sesiones observadas |
| Operación fiscal real | 0 | 0 | Fuera de esta demo |
| Seguridad integral | No evaluada | No evaluada | Controles parciales; sin auditoría |

Autoevaluación de ejecución: integración 6/10, comprobación de lógica 6/10, validación de experiencia 3/10. Los límites publicados son parte de la evaluación; no se asignan notas de superioridad sin uso observado.

## Comparación competitiva

Referencia a ofertas públicas consultadas el 2026-09-05; no se probaron cuentas de competidores. Esta fase mejora la continuidad de Wedge, pero no demuestra ventaja comercial.

| Referencia | Oferta registrada en la investigación | Situación de Wedge |
|---|---|---|
| Heru | Preparación, autorización y presentación de declaraciones | Recorrido simulado con progreso guardado; sin paridad fiscal |
| Alegra México | Contabilidad, bancos, inventario y facturación | Alcance limitado al mes fiscal ficticio |
| CONTPAQi | Herramientas contables y administrativas profesionales | Sin motor contable ni integraciones equivalentes |

Fuentes de esa investigación: https://www.heru.app/preguntas-frecuentes/ · https://www.alegra.com/mexico/precios/ · https://www.contpaqi.com/contabilidad

## Avance de privacidad

Sección Privacidad con exportación JSON del registro propio y eliminación efectiva de la fila activa, confirmada por el usuario. Revisión aleatoria para rechazar escrituras sobre un registro borrado y recreado. La migración añade una columna sin borrar progreso anterior. Se retiraron fuentes externas de Google. Inventario y procedimientos en PRIVACIDAD.md y OPERACION.md.

| Métrica /10 | Fase 3 | Avance fase 4 |
|---|---:|---:|
| Exportación del registro propio | 0 | 6 |
| Eliminación de la fila activa | 0 | 6 |
| Protección ante registro recreado | 0 | 6 |
| Validación con usuarios | 0 | 0 |
| Cumplimiento legal integral | No evaluado | No evaluado |

Autoevaluación: implementación 6/10, pruebas de lógica 6/10, validación en navegador 3/10. Cinco pruebas nuevas comprueban exportación, aislamiento de borrado, rechazo tras recreación, requisitos de eliminación y compatibilidad de la migración. La fase 4 continúa abierta: faltan aviso definitivo, responsables, canal y retención/restauración verificados. No se realizaron pruebas con cuentas reales ni borrados sobre datos de usuarios en producción.

La comparación competitiva anterior sigue siendo una referencia de alcance, no una evaluación nueva de privacidad de competidores. No se ha demostrado que Wedge elimine o exporte mejor que Heru, Alegra o CONTPAQi.

## Próximo paso

Completar validación de acceso y uso real de la demo. Desarrollar fase 4: mapa de datos, retención/eliminación, responsables y procedimientos de atención e incidentes antes de incorporar datos fiscales reales.

## Avance de fase 5 — documentos sintéticos

Implementada la lectura real de seis XML de prueba y la detección de duplicados, contenido conflictivo, datos faltantes, periodo distinto y método PPD. Los resultados persisten por cuenta e integran exportación y eliminación. Sin carga de archivos externos ni cambios de importes fiscales. La fase 4 mantiene sus pendientes; esto es preparación de la ingesta, no habilitación para recibir documentos de clientes.

| Métrica /10 | Antes | Ahora | Evidencia |
|---|---:|---:|---|
| Extracción de metadatos de XML sintéticos | 0 | 6 | Casos estructurales y límites probados |
| Detección de copias y conflictos | 0 | 6 | Huella y UUID; no acumula copias |
| Persistencia y privacidad de resultados | 0 | 6 | Aislamiento, exportación y borrado probados |
| Validez fiscal de documentos reales | 0 | 0 | Fuera del alcance |
| Usabilidad observada | 0 | 0 | Sin prueba de navegador/usuarios |

Autoevaluación: implementación 6/10, comprobación de lógica 6/10 y validación de experiencia 3/10. Escala de madurez ya definida; no son porcentajes de éxito.

Comparación: frente al alcance contable de Heru, Alegra y CONTPAQi registrado en la investigación inicial, Wedge sigue ofreciendo un ensayo con datos sintéticos. No se probaron sus lectores de XML ni se demuestra ventaja de precisión, velocidad o precio.

Siguiente hito: validación del recorrido y cierre de requisitos de privacidad antes de aceptar documentos reales. Motor fiscal integral, presentación y pagos siguen sin implementar.

## Avance de fase 6 — simulación ISR

Tabla mensual RESICO implementada como función pura versionada. Simulador en Cierre con entradas locales, desglose y exportación TXT. Aritmética exacta en centavos, rechazo de casos fuera de alcance y aviso de retenciones excedentes. No altera importes ficticios ni estados del cierre. Ver CALCULO.md.

| Métrica /10 | Antes | Ahora | Evidencia |
|---|---:|---:|---|
| Aritmética de tabla mensual ISR | 0 | 6 | Fronteras, tasas completas y redondeo probados |
| Explicación y trazabilidad del cálculo | 0 | 6 | Entradas, operación, fuente y versión en resultado |
| Tratamiento de retenciones del ejemplo | 0 | 6 | Casos menores, iguales y excedentes probados |
| Revisión profesional fiscal | 0 | 0 | Pendiente |
| Operación contable integral | 0 | 0 | Sin IVA, SAT ni cobros |

Autoevaluación: implementación 6/10, pruebas aritméticas 6/10, validación en navegador 3/10. Siete pruebas nuevas llevan el total a 37. Fase 6 abierta: no cumple aún la revisión profesional de salida.

Comparación competitiva: este cálculo acotado no demuestra paridad operativa con Heru, Alegra o CONTPAQi. No se compararon resultados autenticados de esos productos; no se asignan notas de superioridad.

Siguiente hito: validar la experiencia del simulador y preparar casos revisables antes de conectarlo a documentos y cierres reales. Mantener abiertos los pendientes de privacidad y operación.

## Consolidación técnica — 2026-09-06

Se mantienen las 37 pruebas de módulos/API y se agregan seis de integración sobre el Worker compilado con D1 local. Todas pasaron en este entorno, incluida recuperación tras reiniciar el runtime, cierre completo, lectura XML, exportación, eliminación y concurrencia. No se utilizaron cuentas reales o datos de producción.

Workflow de GitHub Actions preparado para ejecutar instalación bloqueada, pruebas, compilación e integración por cada cambio en main o PR. Su resultado remoto se consulta en Actions; no se equipara el archivo de configuración con una ejecución aprobada ni con protección de rama.

| Métrica /10 | Antes | Ahora | Evidencia |
|---|---:|---:|---|
| Integración del Worker compilado | 0 | 6 | Seis escenarios HTTP/D1 aprobados |
| Recuperación tras reiniciar runtime local | 0 | 6 | Registro idéntico tras reinicio |
| Verificación automatizable | 2 | 6 | Comando integral y workflow versionado |
| Inicio de sesión real y QA visual | 0 | 0 | Pendientes |
| Restauración de respaldo de producción | 0 | 0 | Pendiente |

Autoevaluación: integración técnica 6/10, verificaciones reproducibles 6/10, experiencia observada 3/10. No se altera la puntuación de operación fiscal ni se declara superioridad frente a Heru, Alegra o CONTPAQi: estas son pruebas internas, no una comparación de sus productos.

La siguiente decisión debe priorizar validar uso y requisitos pendientes antes de añadir más funciones. Las fases 3–6 conservan los pendientes de sesión real, privacidad operativa, documentos autorizados y revisión profesional.

## Incremento: documentos y cobros conectados — 2026-09-06

Resumen principal calculado desde registros guardados, selección de mes, confirmación/deshacer cobro completo y descarga TXT. Copias no duplican importes y versiones conflictivas excluyen el folio entero. Nueva columna aditiva collections; exportación y eliminación abarcan sus registros. El cierre ilustrativo y el simulador ISR siguen separados.

| Métrica observable | Antes | Ahora |
|---|---|---|
| Resumen principal | Importes fijos | Derivado de documentos y cobros sintéticos |
| Mes de cobro independiente de emisión | No | Julio–septiembre, cobro completo |
| Folio en conflicto dentro de sumas | Sin resumen conectado | Excluido con aviso |
| Pruebas de módulos/API | 37 | 47 |
| Integración Worker | 6 | 6, ahora con persistencia de cobros |
| Conciliación bancaria y comprobación fiscal real | No | No |

Autoevaluación orientativa de esta entrega, no certificación: lógica y trazabilidad 7/10 (casos y fuente de importes); verificación técnica 7/10 (módulos, API, Worker y CI); experiencia comprobada 3/10 (sin QA visual/sesiones reales). No se afirma superioridad frente a CONTPAQi o Alegra: no hay benchmark con tareas y cuentas equivalentes. Ahorro de tiempo y disposición a pagar continúan sin medir. Este incremento no cierra la fase 5 ni habilita comercialización.

## Incremento: versiones comparables y decisiones registradas — 2026-09-07

Comparación de documentos con igual folio, selección confirmada y exclusión reversible. El resumen usa la versión elegida; el cobro incompatible permanece señalado y excluido. Historial por cuenta con fecha y huellas, incluido en exportación/eliminación. Sin cambios de reglas fiscales.

| Métrica | Antes | Ahora |
|---|---|---|
| Folios con versiones distintas | Exclusión sin salida | Comparación y elección explícita |
| Historial de elecciones | No | Hasta 50 entradas por registro de demo |
| Cambio de versión con cobro previo | Sin flujo | Conserva y excluye el cobro incompatible |
| Pruebas de módulos/API | 47 | 56 |
| Integración Worker | 6 | 6, incluye elección y recuperación |
| Autenticidad de CFDI / operación fiscal real | No verificada | No verificada |

Autoevaluación orientativa: lógica/trazabilidad 7/10; verificación técnica 7/10; experiencia comprobada 3/10 (sin QA visual). No se declara fase 5 terminada ni superioridad frente a CONTPAQi/Alegra: sigue pendiente un benchmark equivalente de tiempo, errores y costo con usuarios reales.

## Revisión de interfaz por código — 2026-09-07

La revisión visual solicitada quedó bloqueada por la política de URL del navegador. No se realizó ni se califica como aprobada. Se corrigieron defectos comprobables por código: salto al contenido que cambiaba la ruta, selección semántica de subapartados, texto demasiado pequeño, controles de 36 px, cabecera rígida y falta de área segura/reserva para la navegación móvil. Ver REVISION-INTERFAZ.md.

| Dimensión | Antes | Cambio comprobado en código |
|---|---|---|
| Salto al contenido | Activaba #main en el enrutador | Conserva la sección y enfoca main |
| Ayuda/cierre | 36 × 36 px declarados | 44 × 44 px declarados |
| Párrafos principales | 14–15 px en varias vistas | 16 px declarados |
| Cabecera | Altura fija sin envolver | Altura mínima y ajuste de líneas |
| Revisión visual | Pendiente | Bloqueada por entorno; sigue pendiente |

Autoevaluación: ejecución de correcciones 7/10; validación visual no evaluada. No se incrementa la puntuación de experiencia ni se afirma ventaja frente a competidores sin evidencia visual o pruebas comparables.

## Incremento: Movimientos usa los registros de Resumen — 2026-09-07

Se retiró la lista fija del apartado Movimientos y se conectó al resumen mensual existente. Cada folio aparece una vez, con emisión y cobro separados; filtros para cobrado, pendiente y revisión. Confirmación/deshacer/descarga reutilizan el flujo y el almacenamiento actuales. El cierre ilustrativo sigue separado.

| Métrica | Antes | Ahora |
|---|---|---|
| Fuente de Movimientos | Lista fija | Registros guardados usados por Resumen |
| Totales entre secciones | Podían diferir | Misma función y datos de entrada |
| Filtros de cobros y revisión | No disponibles | Cuatro opciones |
| Pruebas de módulos/API | 56 | 60 |
| Integración Worker | 6 | 6, incluye recurso de Movimientos |
| Revisión visual | Bloqueada | Pendiente, sin nueva afirmación de validación |

Autoevaluación orientativa: coherencia de datos 7/10, ejecución técnica 7/10, experiencia visual no evaluada. No se cierra una fase comercial ni se declara ventaja frente a otros productos sin pruebas comparables.

# Auditoría de fundamentos — 2026-09-14

## Dictamen

Wedge es una demo privada coherente y probada. Todavía no es un sistema contable ni fiscal: trabaja con seis CFDI sintéticos, un resumen de cobros, un cálculo mensual de ISR limitado y un cierre explícitamente simulado. La siguiente inversión debe convertir hechos importados en registros trazables antes de ampliar la interfaz o automatizar trámites.

```text
Demo y recorrido sintético       ███████░░░  7/10
Pruebas del núcleo actual        ███████░░░  7/10
Seguridad para datos sintéticos  ██████░░░░  6/10
Ingesta y procedencia real       █░░░░░░░░░  1/10
Contabilidad de doble partida    ░░░░░░░░░░  0/10
Operación fiscal real            ░░░░░░░░░░  0/10
Validación con usuarios          ░░░░░░░░░░  0/10
```

La escala mide evidencia observable en este repositorio: 0 ausente, 5 implementado con límites y 10 operado de forma sostenida. No mide probabilidad de éxito comercial.

## Alcance y método

- Revisión de todo el árbol versionado, historial Git, esquema y migraciones, documentación, pruebas y configuración de CI.
- Ejecución local con Node 24.14.1 y npm 11.11.0.
- Investigación externa recuperada el 2026-09-14. Los detalles están en [proyectos abiertos](../research/OPEN-SOURCE-2026-09-14.md), [mercado](../research/MARKET-2026-09-14.md) y [SAT/RESICO](../tax/SAT-RESICO-2026.md).
- No se usaron cuentas, credenciales, CFDI ni datos fiscales reales.

## Cobertura del encargo

| Requisito | Evidencia |
|---|---|
| 1. Estado del repositorio | Secciones “Qué existe” e “Incompleto, muerto, duplicado o riesgoso” de este documento |
| 2. Mapa de arquitectura | Diagrama, límites de confianza y estructura D1 de este documento |
| 3. Proyectos abiertos | [Matriz, mantenedores, licencias y seguridad](../research/OPEN-SOURCE-2026-09-14.md) |
| 4. Mercado y competidores | [México, productos con IA, fricción y oportunidad](../research/MARKET-2026-09-14.md) |
| 5. SAT y RESICO | [Registro de fuentes primarias, fecha, aplicabilidad e incertidumbre](../tax/SAT-RESICO-2026.md) |
| 6. Amenazas | [Matriz priorizada e invariantes](../security/THREAT-MODEL-2026-09-14.md) |
| 7. Dominio | [Entidades, doble partida y separación de capas](../product/V0-FOUNDATION.md) |
| 8. V0 pequeño | [Flujo importar → explicar y métricas de salida](../product/V0-FOUNDATION.md) |
| 9. Ruta | [NOW / NEXT / LATER](../product/V0-FOUNDATION.md) |
| 10. Backlog | [Tareas con alcance, aceptación, pruebas y seguridad](../BACKLOG.md) |
| Primera mejora | WDG-001 y WDG-002 implementadas, verificadas y registradas en `docs/ESTADO.md` |

## Qué existe

| Área | Estado observado | Evidencia | Decisión |
|---|---|---|---|
| Acceso | Funciona detrás del despachador autenticado de Sites | La página y API exigen `oai-authenticated-user-id` | Conservar; documentar que el Worker directo permite suplantación |
| Persistencia | Funciona para la demo | D1 guarda una fila y una revisión por usuario | No extender este registro JSON como sistema financiero |
| Concurrencia | Funciona | Escritura condicional por versión y revisión; casos 409 probados | Reutilizar el patrón en comandos futuros |
| Privacidad | Parcial | Exporta y elimina la fila activa | Definir retención, respaldos, restauración, responsable y canal antes de datos reales |
| CFDI | Parcial | Parser CFDI 4.0 con límites contra DTD/entidades, tamaño, profundidad y duplicados | Mantener como lector sintético; falta validación integral y estado SAT |
| Cobros | Parcial | Confirmación manual y resumen por mes | Tratar como hipótesis del usuario, no como movimiento bancario |
| ISR RESICO | Parcial | Cálculo puro, determinista, con tabla y retenciones | Mantener como estimador; falta elegibilidad, IVA, reglas de periodo y revisión fiscal |
| Cierre | Demo | Máquina de estados y expediente rotulado como simulación | No usar sus estados `filed`/`paid` como hechos fiscales |
| Interfaz | Funcional por código | Navegación, estados y móvil implementados | Falta QA visual y prueba con dos cuentas reales |
| CI | Parcial | 60 pruebas de módulos/API, 6 de Worker y compilación | Agregar tipos, lint y auditoría de dependencias como puertas separadas |
| IA | Ausente | No hay proveedor, prompts, herramientas ni registros de inferencia | Correcto para V0; primero construir el núcleo determinista |

## Incompleto, muerto, duplicado o riesgoso

| Tipo | Hallazgo | Efecto | Acción |
|---|---|---|---|
| Incompleto | No existe importación de archivos del usuario, CSV bancario ni descarga SAT | El flujo central no puede usarse con un mes real | Primer producto: importación manual y normalización segura |
| Incompleto | `ledger.mjs` es un resumen de caja, no un libro contable | No hay asientos, cuentas, balance ni invariantes | Introducir doble partida interna después del modelo de hechos |
| Incompleto | No hay entidad fiscal, periodos, cuentas, transacciones, partidas ni auditoría | Una fila JSON mezcla estado de UI con información de dominio | Crear esquema normalizado mediante migraciones aditivas |
| Corregido | Next 16.2.6 tenía avisos críticos corregidos en 16.3.3 o posterior | Riesgo de ejecución de código en rutas afectadas | WDG-001 actualizó a 16.3.5 y cerró avisos de producción |
| Corregido | `tsc --noEmit` fallaba y CI no lo ejecutaba | Errores de tipos del runtime Cloudflare podían entrar a `main` | WDG-002 declaró el binding D1 y añadió typecheck a CI |
| Riesgoso | La identidad es confiable sólo detrás de Sites | Un despliegue directo aceptaría una cabecera falsificada | Hacer explícito el invariante y probar el borde de despliegue |
| Riesgoso | XML se convierte a DOM completo | Archivos reales hostiles pueden agotar memoria pese a límites actuales | Mantener límites estrictos y aislar análisis antes de habilitar carga |
| Riesgoso | Sin retención/restore probado | Borrado o incidente puede ser irreversible o incompleto | Definir RPO/RTO y hacer ejercicio de restauración sintético |
| Duplicado | `docs/ESTADO.md` registra conteos históricos como si fueran actuales | La primera sección dice 37 pruebas aunque hoy hay 60 | Añadir estado canónico actual y conservar historia abajo |
| Muerto/obsoleto | `apps/web/README.md` describe decisiones futuras ya resueltas | Confunde a quien retome el proyecto | Actualizar o retirar en una tarea documental |
| Limitación | Scripts de verificación usan Bash | `npm run verify` no funciona en Windows sin WSL actualizado | Hacer scripts portables o documentar el entorno oficial |

## Arquitectura actual

```mermaid
flowchart LR
  U[Persona usuaria] --> S[Despachador autenticado de Sites]
  S --> P[GET / · HTML estático]
  S --> A[/api/progress]
  P --> UI[public/app.mjs]
  UI --> WF[workflow + documentos + cobros + ISR]
  UI --> A
  A --> PS[progress-service.mjs]
  PS --> D1[(D1: demo_progress)]
  CAT[6 XML sintéticos incluidos] --> DOC[read-cfdi.mjs]
  DOC --> PS
```

### Límites de confianza

1. Sites autentica y agrega la identidad; la aplicación no autentica esa cabecera por sí sola.
2. El navegador puede proponer eventos, pero el servidor valida orden, tamaño, origen y versión.
3. D1 es el único estado persistente; los valores del simulador ISR viven en memoria local.
4. Los XML provienen de un catálogo incluido en el servidor. La ruta actual no acepta archivos arbitrarios.

### Estructura de datos actual

`demo_progress` contiene `user_id`, etapa, JSON de pendientes/documentos/cobros/decisiones, versión, revisión y fecha. Es suficiente para reanudar una demo y probar aislamiento. No permite responder de forma robusta quién importó un archivo, qué regla produjo una cifra, qué hecho cambió, qué asiento se afectó o qué evidencia respalda un estado fiscal.

## Verificación reproducida

| Comprobación | Resultado | Lectura correcta |
|---|---:|---|
| `npm run test:unit` | 60/60 | Núcleo importado por pruebas pasa |
| Cobertura experimental de Node | 98.62% líneas; 84.99% ramas | Sólo módulos importados; no cubre toda la interfaz/rutas/runtime |
| Integración Worker + D1 | 6/6 | Artefacto compilado responde con D1 local |
| `npx vinext build` | Pasa | Compila `/` y `/api/progress` |
| ESLint | 0 errores, 1 aviso | Exportación anónima en `page-template.mjs` |
| `npx tsc --noEmit` antes de WDG-002 | Fallaba | Faltaban tipos de `cloudflare:workers`, `Fetcher` y `D1Database` |
| `npm run typecheck` después de WDG-002 | Pasa | Binding D1 y runtime Cloudflare tipados; puerta añadida a CI |
| `npm audit --omit=dev` antes de WDG-001 | 1 crítica, 4 altas, 1 moderada | Next y dos transitivas tenían corrección disponible |
| `npm audit --omit=dev` después de WDG-001 | 0 avisos | Next 16.3.5, `fast-uri` 3.1.7 y `baseline-browser-mapping` 2.11.23 |
| `npm audit` completo después de WDG-001 | 11 altas, 5 moderadas, 1 baja | Riesgo de toolchain: Vinext/Cloudflare/Drizzle y transitivas; requiere actualización separada |

La actualización de Next responde a los avisos críticos oficiales [GHSA-p293-qw3h-jr36](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) y [GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), corregidos desde 16.3.3. La revisión del artefacto detectó React Server DOM 19.2.6 dentro del Worker, por lo que React, React DOM y React Server DOM también subieron juntos a 19.2.8. Para tipos se siguió la [guía TypeScript de Cloudflare Workers](https://developers.cloudflare.com/workers/languages/typescript/); este starter no tiene un archivo Wrangler canónico para generar bindings, por lo que se fijó el paquete de tipos a la versión compatible con su runtime y se declaró `DB` de forma local.

## Decisiones de arquitectura

- Mantener un monolito modular en el mismo Worker mientras el volumen y los límites de Cloudflare lo permitan.
- Separar hechos importados, interpretación, contabilidad y estimación fiscal. Cada capa conserva referencias a la anterior.
- Usar doble partida como núcleo interno porque permite balances, correcciones trazables y conciliación; no exponer jerga contable en la primera experiencia.
- Guardar resultados de IA como propuestas con versión, confianza, evidencia y decisión humana. Ningún resultado de IA modifica el libro o un estado fiscal directamente.
- No almacenar e.firma, clave privada, contraseña SAT o CIEC en la nube de Wedge. Una futura automatización SAT debe usar un puente local aislado y requiere un threat model nuevo.
- No ejecutar una migración de dominio significativa durante esta auditoría. El modelo propuesto necesita una revisión de invariantes antes de crear tablas.

## Riesgos y oportunidad inmediata

El [modelo de amenazas](../security/THREAT-MODEL-2026-09-14.md) prioriza límites de identidad, separación entre simulación y hechos, aislamiento por contribuyente y archivos hostiles. Las dos primeras tareas cerraron los avisos del runtime de producción y el typecheck. Los avisos de herramientas de desarrollo quedan separados en WDG-002A para evitar una actualización amplia sin probar compatibilidad con Sites.

## Criterio para avanzar

Wedge puede iniciar un V0 con datos reales únicamente cuando cumpla en conjunto: importación limitada y segura; aislamiento por entidad; procedencia verificable; bitácora inmutable; respaldo/restauración probado; términos de retención; y estados fiscales que nunca excedan la evidencia disponible. El flujo propuesto está en [Fundamento V0](../product/V0-FOUNDATION.md) y las tareas en [Backlog](../BACKLOG.md).

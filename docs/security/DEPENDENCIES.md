# Dependencias y alcance de la auditoría

Revisión: 2026-09-14 (America/Chihuahua). Rama de trabajo; sin despliegue.

## Decisión WDG-002A

Se conserva Vinext 0.0.50 y Miniflare 4. El plugin Cloudflare 1.49.0 fija Wrangler 4.116.0, Miniflare 4.20260730.0 y workerd 1.20260730.1. Los tipos Cloudflare se alinean con 5.20260730.1. Los metadatos de npm confirman esos requisitos; `npm ls` no reporta conflictos.

Tres sustituciones acotadas en `package.json` corrigen versiones que los padres fijan exactamente:

| Padre | Biblioteca | Versión elegida | Motivo |
|---|---|---|---|
| Vinext | image-size | 2.0.4 | Corrige parsers de imágenes que pueden entrar en bucles; conserva API 2.x |
| Miniflare | sharp | 0.35.4 | Correcciones de bibliotecas nativas; actualiza el parche 0.35.x |
| Miniflare | undici | 7.29.0 | Correcciones de HTTP, TLS, caché y cookies; conserva API 7.x |

También se actualizaron dentro de sus rangos las transitivas Babel, brace-expansion, browserslist, fflate, js-yaml y esbuild. Las sustituciones deben retirarse cuando los padres incorporen las versiones corregidas. No se usan `--force`, versiones preliminares nuevas ni una versión anterior de Drizzle.

## Qué demuestra cada control

- `npm audit --omit=dev`: sólo el árbol clasificado como producción por npm.
- `npm audit --audit-level=high`: incluye todo el árbol y falla con avisos altos/críticos.
- Build y pruebas de Worker: comprueban compatibilidad observable, acceso, persistencia, concurrencia y recursos servidos.

**Corrección del informe anterior:** cero avisos en `--omit=dev` no equivale a cero avisos del Worker. Vinext y React Server DOM están declarados como desarrollo y pueden aportar código al artefacto. Tampoco una auditoría en cero certifica seguridad general.

## Excepción pendiente, sin ocultar

`npm audit` completo conserva cuatro entradas moderadas para una misma cadena:

```text
drizzle-kit 0.31.10 → @esbuild-kit/esm-loader → core-utils → esbuild 0.18.20
```

Aviso: [GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99). Afecta al servidor de desarrollo de esbuild por acceso desde otros sitios. El uso actual de Drizzle genera SQL local; no inicia ese servidor, no usa Drizzle Studio y no forma parte del Worker. La corrección automática propuesta por npm retrocede Drizzle a 0.18.1, incompatible con el flujo actual, y se descarta.

Control: no iniciar esbuild serve ni Studio desde esa cadena; mantener el servidor Wedge en loopback. Revisar esta excepción antes de cambiar comandos de DB y como máximo el 2026-10-14. CI muestra los avisos moderados y bloquea altos/críticos; no existe una exclusión silenciosa por paquete.

## Verificación y portabilidad

Los comandos `build`, `dev`, `start`, `lint`, `db:generate` e integración usan `scripts/run-local.mjs`, con ejecutables Node del lockfile y sin shell. Conserva HOME, caché npm y proxies. Build e integración tienen límites de tiempo y terminan sólo su árbol de procesos.

El script histórico `install:ci` sigue reservado al entorno Linux original. El flujo portátil usa `npm ci --ignore-scripts --no-audit --no-fund`, después `npm run verify` y `npm run lint`. CI ejecuta Windows y Ubuntu. La verificación local no se presenta como evidencia de CI remoto.

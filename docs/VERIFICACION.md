# Verificación continua de Wedge

Fecha: 2026-09-06. Consolidación técnica de las fases implementadas; no se inicia una nueva fase comercial.

## Dos niveles de evidencia

37 pruebas de módulos/API: recorrido, aislamiento con SQLite, documentos y simulador ISR. Seis pruebas adicionales ejecutan el Worker compilado mediante Miniflare y D1 local:

1. Página protegida, respuesta sin sesión, cabeceras y recursos JavaScript/CSS/SVG.
2. Recorrido completo, lectura real del XML sintético, exportación y aislamiento por cuenta.
3. Dos escrituras simultáneas: una se guarda y la otra recibe conflicto.
4. Eliminación y recreación: el estado antiguo no puede borrar el nuevo.
5. Reinicio del runtime: recupera exactamente el registro persistido.
6. Origen inválido y XML ajeno al catálogo rechazados.

La base se crea en un directorio temporal único y se borra al terminar. Solo se usan identificadores sintéticos. Se aplican las migraciones SQL versionadas al entorno aislado. No se contacta la web de producción ni se usan credenciales de clientes.

Esta ejecución valida integración HTTP y persistencia con el runtime local de Workers. No valida cookies de ChatGPT, autenticación real del despachador, experiencia visual, restauración de respaldos en producción ni exactitud fiscal profesional. Una prueba de reinicio no equivale a un plan de recuperación ante pérdida de base de datos.

## Comandos

Con Node 24, dependencias del lockfile y Linux:

```bash
npm run test:unit
npm run build
npm run test:integration
```

`npm run verify` ejecuta esos tres pasos en orden. `test:integration` exige una compilación actual en dist/; no recompila implícitamente. Tiene límite de tiempo y termina con error si el runtime no arranca o falla una comprobación. El script no convierte fallos en éxitos ni omite pruebas por limitaciones del entorno.

## GitHub Actions

`.github/workflows/ci.yml` ejecuta instalación bloqueada, pruebas, compilación e integración al actualizar main, abrir/actualizar pull requests a main o iniciar manualmente el workflow. Versiones de las acciones fijadas por SHA y Node 24.19.0. Solo permisos contents:read, sin credenciales persistentes de checkout, secretos de producción o despliegue. No instala scripts de ciclo de vida npm. Una ejecución nueva cancela la anterior del mismo grupo para limitar consumo.

La disponibilidad y resultado de ejecución remota dependen de GitHub Actions y se consultan en el repositorio. No se configuraron reglas de protección de rama: el workflow reporta fallos, pero no impide por sí solo un merge. La publicación privada sigue gestionándose por separado después de verificar la versión.

Referencias técnicas: [Miniflare para pruebas](https://developers.cloudflare.com/workers/testing/miniflare/writing-tests/), [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node).

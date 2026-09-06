# Wedge

Proyecto iniciado desde cero: https://github.com/frogo777/wedge_next

## Estado

Demo privada del mes fiscal para RESICO. Incluye movimientos ficticios, pendientes, cierre simulado y expediente sin validez fiscal. El progreso de agosto se guarda por cuenta en D1 y se recupera al volver. Julio y septiembre son ejemplos fijos. El acceso utiliza la identidad de ChatGPT proporcionada por Sites.

No conecta al SAT, no recibe documentos fiscales, no calcula impuestos reales ni presenta declaraciones o ejecuta pagos. No es todavía un servicio comercial.

## Estructura

- `app/route.ts` y `app/page-template.mjs`: página y acceso.
- `public/`: interfaz CSS/JS y máquina de estados pura `workflow.mjs`.
- `app/api/progress/route.ts`, `app/progress-service.mjs`: validación, aislamiento y guardado.
- `db/schema.ts`, `drizzle/`: esquema y migración versionada.
- `worker/`, `build/`, `scripts/`: ejecución y compilación para Sites.
- `tests/`: pruebas de recorrido y API con SQLite real.
- `docs/`: producto, arquitectura, ruta y evidencia.
- `dist/`: resultado generado, excluido de Git.

## Desarrollo y comprobación

Node.js 24 permite ejecutar las pruebas basadas en `node:sqlite`.

```bash
npm ci
npm run build
node --test tests/*.test.mjs
```

El entorno de Sites incorpora sus propias dependencias y herramientas de compilación. `npm run dev` sirve para desarrollo. Las cabeceras de identidad solo son confiables detrás del despachador de Sites: publicar este Worker directamente sin sustituir la autenticación permitiría suplantaciones. No simular identidades con datos de usuarios reales.

## Prueba manual de la versión privada

1. Entrar con la cuenta autorizada y resolver un pendiente de agosto.
2. Recargar: debe conservarse el progreso.
3. Resolver el otro pendiente y seguir revisión, autorización, presentación y pago simulados.
4. Descargar el expediente rotulado como demostración.
5. Reiniciar la demo: vuelve al estado inicial de esa cuenta.
6. En dos pestañas abiertas, intentar guardar sobre una versión anterior: la segunda debe solicitar recargar.

No se ha realizado QA visual ni una prueba de inicio de sesión con dos cuentas reales. Las tipografías se solicitan a Google Fonts. No agregar secretos, archivos de e.firma o información fiscal real.

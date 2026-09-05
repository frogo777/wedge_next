# Wedge

Proyecto nuevo iniciado desde cero. Fuente: https://github.com/frogo777/wedge_next

## Fase actual

Primer prototipo navegable del Mes Fiscal con datos ficticios. Incluye resumen financiero, movimientos filtrables, resolución de pendientes y cierre simulado con aprobación, presentación, pago y descarga de un expediente sin validez fiscal.

No hay conexión al SAT, cuentas, cobros, datos reales ni motor fiscal validado. Los cambios viven en memoria y se reinician al recargar. Las tipografías se solicitan a Google Fonts; el resto de recursos del prototipo se sirve desde el sitio.

## Estructura

- `dist/`: HTML, CSS y JavaScript escritos a mano; son el código fuente versionado del prototipo estático, no archivos generados.
- `dist/workflow.mjs`: máquina de estados del recorrido simulado.
- `tests/workflow.test.mjs`: pruebas de orden de estados, bloqueo de saltos y coherencia del ejemplo.
- `apps/web/`: documentación de la futura evolución de la aplicación.
- `packages/fiscal/`: reservado para el motor fiscal, todavía sin implementación.
- `docs/`: alcance, arquitectura, fases y evidencia.
- `.openai/hosting.json`: identidad del sitio de demostración y directorio público.

## Ejecutar localmente

Con Python 3, desde la raíz:

```bash
python3 -m http.server 8000 --directory dist
```

Abrir `http://localhost:8000`. Servir por HTTP es necesario para los módulos JavaScript; no abrir directamente el HTML mediante `file://`.

## Verificar

Con Node.js:

```bash
node --check dist/app.mjs
node --test tests/workflow.test.mjs
```

Las pruebas validan la lógica de demostración, no la exactitud fiscal ni el comportamiento en un navegador. No se requieren dependencias npm.

## Guion de prueba manual

1. En agosto, abrir Pendientes y confirmar el cobro y la revisión del gasto.
2. Abrir Cierre mensual y simular revisión, autorización, presentación y pago, en ese orden.
3. Descargar el expediente y comprobar que se identifica como demostración.
4. Cambiar a septiembre para ver el estado vacío; a julio para consultar un mes completado.
5. Reiniciar la demo y verificar que vuelven los dos pendientes de agosto.

No se reutilizó código ni historial de proyectos Wedge anteriores. No agregar secretos o información de contribuyentes reales.

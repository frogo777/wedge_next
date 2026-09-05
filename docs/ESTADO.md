# Estado de Wedge

Fecha: 2026-09-05. Proyecto creado desde cero en `frogo777/wedge_next`.

## Fase 2 — prototipo implementado

- Resumen con importes de ejemplo, gráfico y avance del mes.
- Movimientos con filtros de ingresos/gastos.
- Dos tareas revisables que desbloquean el cierre de agosto.
- Revisión, autorización, presentación y pago simulados, en orden obligatorio.
- Expediente descargable identificado como demostración, sin validez fiscal.
- Julio completado y septiembre vacío; reinicio de la demo.
- Navegación por hash, diseño adaptable, diálogos nativos con confirmación y etiquetas de accesibilidad.

Las acciones son locales y no se persisten. No hay servicio contable, motor fiscal, autenticación, integración SAT ni pagos reales. Publicación preparada con acceso privado del fundador; confirmar el resultado de publicación mediante la plataforma.

## Verificación realizada

Seis pruebas de lógica aprobadas: bloqueo de saltos, tareas duplicadas/desconocidas, recorrido completo, protección de información ya aprobada, saldos ilustrativos y advertencias del expediente. Sintaxis JavaScript y referencias locales verificadas. No se ejecutó QA visual o de interacción en navegador. La adaptación móvil está implementada mediante CSS y requiere validación en dispositivos.

## Evaluación de cierre

Escala de madurez: 0 sin implementación; 2 definido; 4 implementado; 6 probado técnicamente; 8 validado con usuarios; 10 operación sostenida. No es una probabilidad de éxito.

| Dimensión de Wedge | Nota /10 | Evidencia |
|---|---:|---|
| Recorrido de demostración | 6 | Lógica del orden de operaciones probada |
| Interfaz y adaptación móvil | 4 | Código implementado, QA visual pendiente |
| Transparencia de la demo | 4 | Etiquetas persistentes, confirmaciones y expediente rotulado |
| Validación con usuarios | 0 | Todavía sin observaciones reales |
| Operación fiscal real | 0 | No implementada |
| Seguridad de datos reales | No evaluada | Esta versión no los recibe |

Autoevaluación: ejecución de prototipo 6/10, claridad de alcance 7/10, validación de interfaz 3/10. Seis pruebas de lógica no equivalen a una auditoría ni permiten asegurar la usabilidad.

## Comparación con competidores

Comparación limitada a sus ofertas públicas consultadas en la fase de investigación del 2026-09-05. No se probaron sus productos autenticados.

| Referencia | Oferta documentada | Wedge en esta fase |
|---|---|---|
| Heru | Declara ofrecer preparación, autorización y presentación de declaraciones | El recorrido es únicamente simulado; no hay paridad operativa |
| Alegra ERP | Contabilidad, bancos, inventario y facturación | Solo experiencia mensual con datos ficticios |
| CONTPAQi | Herramientas contables profesionales y ecosistema administrativo | Alcance mucho menor, centrado en un contribuyente |

Fuentes: https://www.heru.app/preguntas-frecuentes/ · https://www.alegra.com/mexico/precios/ · https://www.contpaqi.com/contabilidad

La hipótesis diferenciadora sigue siendo reducir el trabajo del cliente y hacer visible el seguimiento; aún no se demuestra superioridad respecto de esos servicios.

## Siguiente fase

Validar la experiencia del prototipo y comenzar cuentas/permisos de la fase 3. Antes de aceptar datos reales, diseñar privacidad, aislamiento y responsabilidades operativas. La revisión profesional de cálculos corresponde a una fase posterior.

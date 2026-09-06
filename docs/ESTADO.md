# Estado de Wedge

Fecha: 2026-09-06. Proyecto desde cero en `frogo777/wedge_next`.

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

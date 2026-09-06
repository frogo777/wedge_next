# Estado de Wedge

Fecha: 2026-09-06. Proyecto desde cero en `frogo777/wedge_next`.

## Fases 3 y 4 — acceso y privacidad de la demo

Acceso mediante identidad de ChatGPT en Sites, progreso de agosto persistente por cuenta en D1, cierre de sesión, conflictos entre pestañas y recuperación de errores sin sobrescritura silenciosa. Se conserva el recorrido visual de la fase 2. Migración SQL versionada y salida de compilación separada del código fuente.

El alcance es una demo privada. No hay motor fiscal, SAT, pagos reales, documentos de contribuyentes ni contratación comercial. La verificación del despliegue se registra en Sites; este documento describe el código y sus límites.

## Evidencia

19 pruebas automatizadas de lógica/API: seis del recorrido y trece de acceso y privacidad, aislamiento A/B, entradas adulteradas, origen y tamaño del cuerpo, escritura concurrente, versiones antiguas, guardado/lectura y ausencia de almacenamiento. La API se prueba con SQLite y un adaptador de D1. Compilación del Worker verificada. Las identidades de las pruebas son sintéticas.

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

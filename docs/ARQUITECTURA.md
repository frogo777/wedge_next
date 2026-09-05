# Arquitectura inicial

Estado: límites definidos; tecnologías por seleccionar para esta nueva implementación.

## Separación de responsabilidades

- Interfaz web: muestra datos, estados y acciones comprensibles.
- Servicio de aplicación: aplica permisos, validaciones y transiciones del proceso.
- Motor fiscal: transforma entradas verificadas mediante reglas reproducibles y versionadas.
- Integraciones: reciben documentos o conectan servicios mediante adaptadores sustituibles.
- Asistencia: explica resultados y orienta sobre faltantes; no puede inventar evidencia ni autorizar operaciones.

## Estados y evidencia

Separar datos de ejemplo, estimaciones, cálculo revisado, autorización, presentación y pago. Cambiar un cálculo después de aprobado obliga a obtener una nueva aprobación. Cada avance real requiere actor, fecha, periodo y evidencia apropiada.

## Datos

El primer prototipo no recopilará información de contribuyentes reales. Antes de persistirla, definir aislamiento entre cuentas, acceso de operadores, cifrado, retención, eliminación, registro de consentimiento y restauración de respaldos.

## Próxima decisión técnica

Seleccionar un entorno que permita trabajar en la nube y probar desde navegador, sin exigir procesamiento pesado en la laptop del fundador. Comparar compatibilidad, portabilidad y costos antes de contratar servicios. El repositorio inicial no incorpora proveedores ni dependencias por herencia.

## Decisión de implementación de fase 2

Prototipo estático con módulos JavaScript nativos y CSS, sin dependencias npm. El código fuente se mantiene en `dist/` para el alojamiento estático. Una máquina de estados pura separa las reglas del recorrido de la presentación. Los importes son constantes ficticias, no cálculos fiscales. El estado solo vive en memoria de la página.

Esta decisión reduce infraestructura para evaluar el recorrido. No define todavía la arquitectura de cuentas, datos, integraciones o motor fiscal de producción. El código sigue en el repositorio nuevo; no se importaron componentes de la base anterior.

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

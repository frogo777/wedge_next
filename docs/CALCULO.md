# Simulador mensual de ISR RESICO — fase 6 parcial

Fecha de trabajo y consulta de fuentes: 2026-09-06.

## Alcance que puede probarse

Cierre mensual → Probar simulador de ISR RESICO. El usuario puede explorar cuatro escenarios o cambiar ingreso cobrado sin IVA y retenciones de ISR del mismo mes. Se muestran tasa, impuesto antes de retenciones, retención aplicada, ISR estimado y retenciones pendientes de revisión. Se puede descargar un desglose rotulado como simulación.

Los importes se procesan solo en memoria del navegador. No hay solicitudes de red con esas entradas, persistencia en cuenta, localStorage ni analítica del formulario. Se reinician al recargar y se conservan únicamente en el dispositivo si se descarga el desglose. No se modifica el cierre con importes ficticios de la demo.

## Fuentes y lectura implementada

Se consultó el texto vigente ofrecido por la Cámara de Diputados, que identifica última reforma del 01-04-2024. Se revisaron las páginas 145–146 y 149 del PDF. El artículo 113-E dispone para el cálculo mensual ingresos amparados por CFDI efectivamente cobrados, sin IVA ni deducciones. La tasa se selecciona por el ingreso mensual y se aplica al importe completo. El artículo 113-J contempla retención de ISR por personas morales y su consideración en el pago mensual; el simulador recibe la retención indicada, no calcula ni acredita su procedencia.

| Ingreso mensual hasta MXN | Tasa |
|---|---:|
| 25,000.00 | 1.00% |
| 50,000.00 | 1.10% |
| 83,333.33 | 1.50% |
| 208,333.33 | 2.00% |
| 3,500,000.00 | 2.50% |

- [LISR, texto de Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf)
- [Historial oficial de reformas de la LISR](https://www.diputados.gob.mx/LeyesBiblio/ref/lisr.htm)

Esta implementación aislada no reproduce la RMF 2026 completa ni resuelve excepciones. El límite final de la tabla no significa que exista un límite mensual de elegibilidad independiente del anual.

## Contrato y decisiones de software

Entradas: `income`, `withholding` como cadenas decimales no negativas con hasta dos decimales, y `year: 2026`. No se aceptan comas, símbolos, notación científica, números JavaScript ni claves adicionales como deducciones. Importes por encima de la tabla o retenciones superiores al ingreso del mismo ejemplo quedan fuera de alcance.

El motor selecciona tasa con importes exactos en centavos BigInt; multiplica por puntos base y redondea medio centavo hacia arriba para mostrar centavos. Es una convención explícita de este simulador: no implementa redondeo a pesos del formulario o del pago SAT. No utiliza coma flotante.

La retención aplicada se limita al ISR calculado; la diferencia se muestra como pendiente de revisión, nunca como devolución aprobada ni saldo compensable. La versión de regla, fuente y pasos quedan en el resultado y el TXT. Un cambio de entrada retira el resultado previo y la descarga hasta recalcular. Errores se presentan sin sustituirlos por un cero.

## Casos de referencia y evidencia

37 pruebas totales del proyecto, siete nuevas de cálculo/presentación. Incluyen diez escenarios de tabla, cada frontera y el centavo siguiente, importes vacíos o inválidos, ejercicio no soportado, exactitud de centavos, retenciones menores/iguales/mayores, reproducibilidad y protección contra resultados obsoletos.

| Caso hipotético | ISR antes de retenciones | Retención indicada | ISR estimado |
|---|---:|---:|---:|
| 48,000.00 | 528.00 | 0.00 | 528.00 |
| 48,000.00 | 528.00 | 600.00 | 0.00; 72.00 por revisar |
| 50,000.00 | 550.00 | 0.00 | 550.00 |
| 50,000.01 | 750.00 | 0.00 | 750.00 |

Estos son casos aritméticos de referencia; no son declaraciones presentadas ni resultados validados por un contador. La regla no se debe promover a cálculo operativo hasta cubrir revisión profesional, casos reales autorizados, documentación probatoria, elegibilidad y conciliación con el formulario vigente del SAT. QA en navegador también pendiente.

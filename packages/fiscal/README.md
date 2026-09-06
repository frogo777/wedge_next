# Motor fiscal — simulación parcial de ISR RESICO

`index.mjs` expone el módulo determinista `public/fiscal/resico-isr.mjs`. Se sirve y prueba el mismo archivo ES, sin duplicar reglas entre servidor y navegador. No usa red, IA, almacenamiento o efectos de pago.

Regla `mx-resico-pf-isr-monthly-2026.v1`: tabla mensual general del artículo 113-E de la LISR y resta de retenciones del mismo mes conforme al alcance del artículo 113-J. Fuentes consultadas el 2026-09-06. Las entradas son importes decimales en texto; los cálculos internos usan BigInt. El desglose es serializable y reproducible.

La simulación no verifica elegibilidad, límites anuales, cobros, CFDI, estímulos ni exenciones; no calcula IVA, saldo anual, actualizaciones o recargos. Redondea a centavos para visualización, sin implementar ajustes del formulario SAT. Cero estimado no exime de obligaciones formales ni confirma un saldo a favor.

Consultar `docs/CALCULO.md` para alcance, fuentes, casos y validación pendiente. La revisión profesional y comparación contra declaraciones de referencia siguen pendientes; esta implementación no autoriza uso fiscal operativo.

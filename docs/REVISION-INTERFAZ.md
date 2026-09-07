# Revisión de interfaz — 2026-09-07

## Evidencia disponible

Se intentó la revisión visual solicitada. La vista supervisada arrancó; el navegador rechazó abrirla por política de URL, antes de cargar Wedge. Se detuvo la vista de pruebas. No se usaron rutas alternativas para eludir el bloqueo ni se solicitaron capturas al usuario como requisito para continuar el desarrollo.

Esto no demuestra un defecto de Wedge ni permite calificar su apariencia. No hay capturas, mediciones de geometría en navegador, pruebas en teléfonos reales ni comprobación visual a 200%. La revisión que sigue es de código y debe identificarse así.

## Defectos concretos y cambios

- El enlace «Ir al contenido» apuntaba a #main y el enrutador interpretaba ese fragmento como una vista desconocida, volviendo a Resumen. Ahora enfoca y desplaza hasta main sin cambiar de sección.
- La navegación resaltaba el apartado de una subvista pero no indicaba aria-current. Documentos, Simulador y Recorrido ahora usan la misma selección para apariencia y semántica.
- Los botones de ayuda/cierre tenían 36 × 36 px; pasan a 44 × 44 px. Selectores y enlaces de acción reciben altura mínima y texto legible.
- Varias etiquetas y avisos estaban en 10–12 px. Se elevan a 14 px para información habitual y 16 px para párrafos principales; metadatos quedan al menos en 12 px.
- La cabecera tenía altura fija y no permitía envolver sus elementos. Se permite ajuste a varias líneas para títulos y estados largos.
- La barra inferior móvil tenía altura fija sin considerar el área segura del dispositivo. Se usa altura de contenido, área segura y reserva inferior ampliada. En pantallas muy estrechas el balance pasa a una columna.
- Tablas horizontales ahora tienen región etiquetada, foco por teclado e indicador visible. El menú lateral permite desplazamiento si la altura no alcanza.
- Se elimina una referencia a Manrope no cargada y se corrige el aviso general para incluir documentos/cobros guardados.

## Límites y próxima comprobación

Las reglas CSS expresan la intención, no prueban ausencia de solapamientos, cumplimiento WCAG, calidad visual o comportamiento táctil. Falta recorrer la versión en navegador permitido a anchos 360, 390, 768 y 1440, probar zoom/teclado y confirmar diálogos, errores, desplazamiento y navegación. La revisión visual permanece abierta; se continuará cuando haya acceso permitido o evidencia visual disponible.

No se modificaron cálculos fiscales, documentos ni registros de cuentas. Las pruebas existentes verifican lógica/API/Worker y no se presentan como pruebas visuales.

# Investigación de proyectos abiertos — 2026-09-14

## Conclusión

No conviene adoptar una aplicación contable completa. Wedge puede estudiar tres ideas maduras y mantener su propio núcleo pequeño: invariantes de doble partida, separación entre datos fuente y libro, y colas explícitas para excepciones. Las licencias copyleft y BSL descartan reutilización directa de varios productos.

Actividad, estrellas, contribuidores visibles, avisos públicos y licencias se revisaron en GitHub el 2026-09-14. Esas cifras cambian; cero avisos publicados no demuestra ausencia de vulnerabilidades.

## Matriz

| Proyecto | Propósito | Stack | Licencia | Actividad observada | Ideas útiles | ¿Reusar? | Riesgo principal |
|---|---|---|---|---|---|---|---|
| [Actual Budget](https://github.com/actualbudget/actual) | Finanzas personales local-first con sincronización | TypeScript, React, Node | MIT | ~28.8k estrellas; push 2026-09-15; varios mantenedores activos | Núcleo independiente de plataforma, sync, reglas, conciliación | Conceptos; código puntual sólo con revisión | Complejidad de sync y precedente de acceso cruzado a archivos de presupuesto |
| [Firefly III](https://github.com/firefly-iii/firefly-iii) | Finanzas personales autohospedadas | PHP, Laravel | AGPL-3.0 | ~24.6k estrellas; push 2026-09-15; 5 avisos públicos | Doble partida, reglas, recurrencia, API | Estudiar modelo; no copiar | Copyleft, superficie grande y configuración no segura por defecto |
| [Beancount](https://github.com/beancount/beancount) | Contabilidad de doble partida desde texto | Python | GPL-2.0 | ~6k estrellas; push 2026-08-23; sin avisos publicados | Asientos reproducibles, validaciones e inventarios | Conceptos | GPL y experiencia técnica, lejos del público objetivo |
| [hledger](https://github.com/simonmichael/hledger) | Libro de doble partida y reportes | Haskell | GPL-3.0 | ~4.7k estrellas; actividad 2026; 2 avisos públicos | Consultas, reportes y verificaciones de balance | Conceptos | GPL y stack incompatible |
| [Ledger](https://github.com/ledger/ledger) | Libro contable de línea de comandos | C++ | BSD-3-Clause | ~6k estrellas; push 2026-09-05; sin avisos publicados | Diario inmutable y consultas deterministas | Conceptos; no hace falta integrar | Parser/CLI no resuelven el flujo fiscal mexicano |
| [OpenBB](https://github.com/OpenBB-finance/OpenBB) | Plataforma de datos financieros para analistas y agentes | Python | AGPL-3.0 | ~73k estrellas; push 2026-09-14; sin avisos publicados | Abstracción de proveedores y metadatos de procedencia | Sólo conceptos | Muy fuera de alcance; copyleft y dependencias amplias |
| [Akaunting](https://github.com/akaunting/akaunting) | Contabilidad empresarial web | PHP, Laravel | BSL con límites de producción | ~10k estrellas; actividad 2026; sin avisos publicados | Onboarding y flujos de factura/pago | No copiar | La licencia limita uso productivo, marca y servicio contable |
| [CfdiUtils](https://github.com/eclipxe13/CfdiUtils) | Lectura, generación y utilidades CFDI | PHP | MIT | ~144 estrellas; push 2026-09-13 | Casos de CFDI, complementos, cadena original y consulta SAT | Especificaciones y fixtures | Stack distinto; no sustituye validación fiscal profesional |
| [sat-ws-descarga-masiva](https://github.com/phpcfdi/sat-ws-descarga-masiva) | Cliente del servicio de descarga masiva SAT | PHP | MIT | ~190 estrellas; push 2026-04-08 | Estados de solicitud, paquetes y límites del servicio | Investigación para puente local futuro | Opera con e.firma; compromiso de credenciales sería crítico |
| [python-satcfdi](https://github.com/SAT-CFDI/python-satcfdi) | Procesamiento y generación CFDI | Python | MIT | ~159 estrellas; push 2026-09-14 | Catálogos, complementos, validación y fixtures | Ideas y corpus sintético compatible | Stack distinto; cambios normativos frecuentes |

## Evaluación detallada

### Mantenedores y concentración observada

| Proyecto | Señal de contribuidores | Concentración |
|---|---|---|
| [Actual Budget](https://github.com/actualbudget/actual/graphs/contributors) | MatissJanis, matt-fidd, joel-jeremy, j-f1 y MikesGlitch aparecen entre los principales | Repartido entre varios mantenedores |
| [Firefly III](https://github.com/firefly-iii/firefly-iii/graphs/contributors) | JC5 concentra una parte importante; también hay comunidad y bots | Dependencia alta del autor principal |
| [Beancount](https://github.com/beancount/beancount/graphs/contributors) | blais, dnicolodi, yagebu, trim21 y tbm | Varios contribuidores, liderazgo concentrado |
| [hledger](https://github.com/simonmichael/hledger/graphs/contributors) | simonmichael, Xitian9, adept, thielema y zhelezov | Comunidad estable con mantenedor principal |
| [Ledger](https://github.com/ledger/ledger/graphs/contributors) | jwiegley encabeza un historial amplio | Proyecto maduro, liderazgo concentrado |
| [CfdiUtils](https://github.com/eclipxe13/CfdiUtils/graphs/contributors) y [descarga masiva](https://github.com/phpcfdi/sat-ws-descarga-masiva/graphs/contributors) | eclipxe13 es central | Riesgo de continuidad mayor por equipo pequeño |

Los nombres muestran actividad pública acumulada, no disponibilidad futura ni revisión de identidad.

### Arquitectura y reutilización

- Actual Budget separa su núcleo de la interfaz y del servidor de sincronización. Wedge debe imitar esa frontera para que normalización, conciliación y reglas fiscales sean funciones probables fuera de la UI.
- Beancount, hledger, Ledger y Firefly III convergen en asientos balanceados. Esa convergencia apoya doble partida como representación interna, incluso si el usuario sólo ve ingresos, gastos, cobros y pendientes.
- OpenBB demuestra una interfaz estable sobre proveedores variables. La misma idea sirve para futuras fuentes bancarias, manteniendo cada conector fuera del dominio contable.
- CfdiUtils y los proyectos phpcfdi/satcfdi son referencias útiles para casos límite y fixtures. El código de producción de Wedge debe permanecer en TypeScript y validar contra fuentes SAT vigentes.

### Mantenimiento y comunidad

Los diez repositorios muestran actividad reciente, pero difieren mucho en concentración. CfdiUtils y las bibliotecas SAT dependen de pocos contribuidores; una integración directa tendría mayor riesgo de continuidad. Actual Budget, Firefly III, Beancount y hledger muestran varios contribuidores sostenidos, aunque los dos primeros también exhiben una superficie de seguridad mayor.

### Seguridad

Actual Budget publicó [GHSA-qmjj-p7m9-wjrv](https://github.com/actualbudget/actual/security/advisories/GHSA-qmjj-p7m9-wjrv), un acceso cruzado a archivos de presupuesto corregido en 26.2.1. La lección para Wedge es probar el aislamiento en cada consulta y objeto, no sólo en la sesión. Firefly III publica [política y avisos](https://github.com/firefly-iii/firefly-iii/security); varios problemas históricos abarcan IDOR, MFA y XSS. La madurez funcional no elimina riesgos de autorización y contenido activo.

### Licencias

- MIT/BSD: permiten estudiar y reutilizar con avisos de copyright; aun así, copiar aumenta mantenimiento y superficie de suministro.
- GPL/AGPL: no reutilizar código dentro del producto sin una decisión legal explícita. AGPL agrega obligaciones al ofrecer el software por red.
- BSL de Akaunting: sus parámetros publicados limitan producción y prohíben usos incompatibles con un servicio contable comercial. Se excluye reutilización.

## Qué adoptar ahora

1. Entradas y asientos inmutables, con correcciones mediante reverso o nueva versión.
2. Balance por moneda como invariante del servidor.
3. Procedencia desde archivo/movimiento hasta estimación.
4. Propuestas automáticas separadas de aprobaciones humanas.
5. Adaptadores de fuente detrás de una interfaz pequeña.

## Qué dejar fuera

- Sincronización local-first completa.
- Lenguajes o runtimes adicionales.
- Importar un ERP o un libro contable entero.
- Descarga SAT automática con e.firma en servidores de Wedge.
- Trading, inversiones, nómina, inventario y cuentas por pagar.

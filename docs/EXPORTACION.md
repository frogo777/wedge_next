# Exportación completa de una entidad

Fecha: 2026-09-14. Implementación preparatoria de servidor con datos sintéticos; no hay ruta HTTP ni descarga habilitada.

## Salida

`exportEntityFiles` toma una foto transaccional de los metadatos autorizados en D1 y devuelve un iterador asíncrono:

```text
1. manifest.json
2. sources/{sha256}.xml
3. sources/{sha256}.xml
…  hasta 1,000 originales
```

El manifiesto usa `format: "wedge-full-export"` y `formatVersion: 1`. Incluye la exportación de metadatos versión 2, la ruta relativa, SHA-256, tipo y longitud esperada de cada original, más los totales. Las rutas se derivan únicamente de hashes hexadecimales; no incluyen nombres proporcionados por el usuario ni claves internas de R2.

## Garantías

- Sólo una identidad propietaria puede iniciar y continuar la exportación.
- El estado de D1 queda fijado al crear el manifiesto; una fuente recibida después no aparece en esa copia.
- Cada XML se lee de R2 cuando el consumidor lo solicita, con un máximo actual de 128 KiB por archivo.
- Tamaño y SHA-256 se verifican antes de entregar bytes. Después de la lectura se comprueba otra vez que la entidad siga activa y autorizada.
- Una fuente histórica sin original, una carga pendiente, un borrado, una revocación o bytes dañados producen un error de dominio. No se declara completa una salida parcial.
- No se añadió una biblioteca de compresión ni una copia temporal en la nube.

## Regla para el futuro adaptador de descarga

El consumidor debe escribir en una ubicación temporal y hacer visible el resultado sólo después de agotar el iterador sin error. La futura ruta debe usar autenticación del servidor, `Cache-Control: no-store`, disposición de archivo adjunto y un nombre neutro. Debe explicar que la copia contiene información fiscal sensible y que el usuario será responsable de guardarla o eliminarla de su dispositivo.

El empaquetado descargable y su prueba en Sites siguen pendientes. El registro de borrados y su reconciliador ya están probados localmente, pero faltan lock/lifecycle y simulacro remoto. La carga de documentos reales permanece cerrada hasta validar también una copia completa controlada por el fundador.

# Exportación completa de una entidad

Fecha: 2026-09-15. Implementación con datos sintéticos publicada en la versión privada 12 de Sites; prueba controlada desde la sesión real pendiente.

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

## Descarga autenticada de la demo

`POST /api/export` exige la identidad del despachador Sites, origen de la misma aplicación y la versión/revisión vigente del registro. La interfaz prepara `wedge-copia-completa.zip` con:

```text
demo-progress.json
private-entity/manifest.json
private-entity/sources/{sha256}.xml
```

Al procesar un ejemplo del catálogo cerrado, el Worker conserva ese XML sintético en R2 mediante el protocolo reintentable D1–R2–D1. La ruta sincroniza registros anteriores y después transmite un ZIP sin compresión. El servidor mantiene en memoria sólo un archivo de hasta 128 KiB y el directorio del ZIP; el cierre central se escribe al final. Si una lectura, autorización o hash falla, la descarga queda truncada y no constituye un ZIP completo.

No se aceptan archivos enviados por el navegador. Los nombres del ZIP son constantes o hashes; no incluyen correo, RFC, nombre de archivo ni clave interna de R2. La respuesta usa `private, no-store`, tipo `application/zip`, nombre neutro y protección contra interpretación de contenido.

## Responsabilidad de la copia

El navegador hace visible el resultado sólo después de consumir la respuesta completa. La interfaz avisa que la copia debe guardarse como información privada. Una descarga queda en el dispositivo del usuario y deja de estar bajo el control de Wedge.

La interfaz actual reúne el ZIP completo en memoria antes de iniciar la descarga. Esto es acotado para los seis ejemplos pequeños del catálogo cerrado; debe sustituirse por una descarga nativa o escrita a disco antes de admitir lotes o archivos reales.

Sites desplegó la ruta y la migración 0007, y rechaza solicitudes sin identidad válida. Todavía falta una descarga controlada desde la sesión real que ejercite R2 remoto. El registro de borrados y su reconciliador están probados localmente, pero faltan lock/lifecycle y simulacro de restauración remoto. La carga de documentos reales permanece cerrada hasta completar esas pruebas.

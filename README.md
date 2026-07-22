# YucaFish

Bitácora personal de pesca responsive y mobile-first. Permite registrar salidas y capturas, adjuntar fotografías privadas, consultar estadísticas, administrar el perfil y mantener catálogos de especies y puertos.

## Arquitectura

- Next.js App Router + TypeScript estricto + React.
- Cloudflare D1 para datos relacionales; esquema Drizzle y migraciones versionadas.
- Cloudflare R2 para fotografías; los bytes nunca se guardan en la base de datos.
- Sign in with ChatGPT administrado por Sites. La aplicación no almacena contraseñas, tokens ni cookies de autenticación.
- Autorización por propietario en cada lectura y mutación. Ningún `userId` del cliente se usa para decidir acceso.
- PWA instalable con manifest y experiencia standalone.

Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el modelo, rutas, decisiones, respaldos, despliegue y fase futura.

## Ejecución local

Requiere Node.js 22.13 o superior.

```bash
npm ci
npm run dev
```

La vista local usa únicamente la identidad de demostración `capitan@yucafish.local`, creada automáticamente con rol administrador y registros de muestra. Esta identidad no se habilita fuera de `localhost`.

Los botones **Iniciar sesión** y **Crear cuenta** abren pantallas propias de YucaFish. En local continúan a la cuenta demo; en Sites delegan registro, verificación, recuperación y sesión al proveedor seguro de la plataforma.

## Validación

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:integration # con el servidor local activo
```

`npm test` ejecuta el build de producción, pruebas unitarias de dominio y verificaciones de renderizado. La migración se regenera con `npm run db:generate`.

## Variables

La versión actual recibe DB, R2 e identidad desde Sites. `.env.example` documenta integraciones futuras; nunca se deben guardar secretos en el repositorio.

## Integración meteorológica

YucaFish consulta desde su backend los endpoints oficiales de [pronóstico](https://open-meteo.com/en/docs) y [condiciones marinas](https://open-meteo.com/en/docs/marine-weather-api) de Open-Meteo. El navegador solo envía el identificador de un puerto; las coordenadas, URLs del proveedor y cualquier futura clave se resuelven en el servidor. La integración fue revisada contra la documentación y los términos vigentes el 22 de julio de 2026.

La vista permite seleccionar cualquiera de los 12 puertos configurados y una fecha dentro de los siete días disponibles. Cada día combina clima y mar, muestra horas recomendadas y un indicador orientativo: rojo (complicado), amarillo (precaución), verde (favorable) o azul (ideal). El indicador no garantiza capturas ni sustituye avisos oficiales de navegación o seguridad.

Se solicitan temperatura, sensación térmica, humedad, lluvia, nubosidad, visibilidad, viento, ráfagas, amanecer y atardecer; para mar se solicitan oleaje, swell, temperatura superficial, corrientes y nivel del mar. Los valores ausentes permanecen como `null` y se muestran como “No disponible”. Las series se normalizan y unen por su hora ISO en `America/Merida`.

```env
OPEN_METEO_WEATHER_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_MARINE_URL=https://marine-api.open-meteo.com/v1/marine
DEFAULT_TIMEZONE=America/Merida
WEATHER_CACHE_SECONDS=3600
WEATHER_STALE_SECONDS=21600
WEATHER_REQUEST_TIMEOUT_MS=10000
OPEN_METEO_API_KEY=
```

La caché compartida se guarda en D1 por puerto y tipo (`weather` o `marine`) durante 30–60 minutos. Si el proveedor falla, puede devolverse la última respuesta dentro de la ventana obsoleta, marcada explícitamente. Las consultas privadas admiten 30 solicitudes por minuto por usuario; un snapshot de una pesca solo puede actualizarse una vez cada cinco minutos. El snapshot verifica la propiedad de la pesca y conserva valores normalizados sin guardar la respuesta completa del proveedor.

Los doce puertos iniciales se encuentran en `db/seeds/yucatan-ports.ts`. Las coordenadas terrestres se consultaron en OpenStreetMap/Nominatim; Yucalpetén usa la estación geográfica de SEMAR. Los puntos marinos son desplazamientos públicos aproximados frente a la costa y usan `cell_selection=sea`; un administrador puede corregirlos, habilitar o deshabilitar clima, probar la consulta, limpiar caché y modificar umbrales desde el panel.

Para probar la integración:

```bash
npm run dev
npm test
npm run test:integration
```

Para simular errores, intercepta `fetch` como hacen las pruebas unitarias. Los hosts se restringen a Open-Meteo para impedir SSRF. Un proveedor alternativo debe implementar el cliente, sus esquemas Zod y el mapper hacia `PortForecast`, sin cambiar la UI.

Limitaciones: es un pronóstico orientativo, la precisión de corrientes y mareas es limitada cerca de la costa y no sustituye avisos oficiales ni herramientas de navegación. El plan gratuito de Open-Meteo es únicamente para uso no comercial y exige atribución CC BY 4.0; antes de monetizar YucaFish se debe contratar un plan comercial, configurar su endpoint/clave en servidor y volver a revisar los [términos](https://open-meteo.com/en/terms). Con una hora de caché, doce puertos consultados una vez cada uno consumen aproximadamente 24 solicitudes iniciales (clima + mar) y 24 por cada renovación global del catálogo.

## Primer administrador

En la demo local el perfil inicial es administrador. En producción, después del primer acceso, cambia `profiles.role` de la cuenta autorizada a `ADMIN` mediante una operación controlada de D1. No existe un endpoint público para elevar roles.

## Docker

```bash
docker build -t yucafish .
docker run --rm -p 3000:3000 yucafish
```

La ejecución completa con datos requiere bindings D1/R2 compatibles; Sites es el destino soportado y recomendado.

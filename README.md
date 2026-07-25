# GoFishing.mx

Bitácora personal de pesca responsive y mobile-first. Permite registrar salidas y capturas, adjuntar fotografías privadas, consultar estadísticas, administrar el perfil y mantener catálogos de especies y puertos.

## Arquitectura

- Next.js App Router + TypeScript estricto + React.
- MySQL como base de datos única y obligatoria, conectada exclusivamente mediante `DATABASE_URL`.
- Esquema Drizzle orientado a MySQL. No existe soporte para SQLite ni fallbacks locales.
- Archivos privados almacenados fuera de la base de datos; los bytes nunca se guardan en tablas.
- Autorización por propietario en cada lectura y mutación. Ningún `userId` del cliente se usa para decidir acceso.
- Aplicación Next.js desplegable en VPS Node.js.

Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el modelo, rutas, decisiones, respaldos, despliegue y fase futura.

## Ejecución local

Requiere Node.js 22.13 o superior.

```bash
npm ci
npm run dev
```

La aplicación requiere `DATABASE_URL` válida hacia MySQL desde desarrollo hasta producción. Si falta o apunta a SQLite, el proyecto falla al iniciar.

Los botones **Iniciar sesión** y **Crear cuenta** abren pantallas propias de YucaFish. En local continúan a la cuenta demo; en Sites delegan registro, verificación, recuperación y sesión al proveedor seguro de la plataforma.

## Validación

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:integration # con el servidor local activo
```

`npm test` ejecuta el build de producción, pruebas unitarias de dominio y verificaciones de renderizado. Si se genera una migración, debe revisarse manualmente antes de aplicarla a `yucafish`.

## Variables

La conexión a base de datos se obtiene exclusivamente desde `DATABASE_URL`, con formato `mysql://USUARIO:CONTRASENA@HOST:3306/yucafish`. Nunca se deben guardar secretos en el repositorio.

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

La caché compartida se guarda en MySQL por puerto y tipo (`weather` o `marine`) durante 30–60 minutos. Si el proveedor falla, puede devolverse la última respuesta dentro de la ventana obsoleta, marcada explícitamente. Las consultas privadas admiten 30 solicitudes por minuto por usuario; un snapshot de una pesca solo puede actualizarse una vez cada cinco minutos. El snapshot verifica la propiedad de la pesca y conserva valores normalizados sin guardar la respuesta completa del proveedor.

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

El primer administrador se provisiona mediante un script controlado sobre MySQL. No existe un endpoint público para elevar roles.

## Docker

```bash
docker build -t yucafish .
docker run --rm -p 3000:3000 yucafish
```

La ejecución completa con datos requiere una `DATABASE_URL` MySQL válida y las variables de correo/almacenamiento correspondientes.

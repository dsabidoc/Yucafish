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

## Validación

```bash
npm run lint
npx tsc --noEmit
npm test
```

`npm test` ejecuta el build de producción, pruebas unitarias de dominio y verificaciones de renderizado. La migración se regenera con `npm run db:generate`.

## Variables

La versión actual recibe DB, R2 e identidad desde Sites. `.env.example` documenta integraciones futuras; nunca se deben guardar secretos en el repositorio.

## Primer administrador

En la demo local el perfil inicial es administrador. En producción, después del primer acceso, cambia `profiles.role` de la cuenta autorizada a `ADMIN` mediante una operación controlada de D1. No existe un endpoint público para elevar roles.

## Docker

```bash
docker build -t yucafish .
docker run --rm -p 3000:3000 yucafish
```

La ejecución completa con datos requiere bindings D1/R2 compatibles; Sites es el destino soportado y recomendado.

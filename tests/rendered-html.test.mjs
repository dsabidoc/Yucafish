import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("defines the complete YucaFish public landing page", async () => {
  const source = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(source, /YucaFish/);
  assert.match(source, /Tu historial de pesca/);
  assert.match(source, /Crear cuenta/);
  assert.match(source, /PESCA RESPONSABLE/);
  assert.doesNotMatch(source, /codex-preview|react-loading-skeleton/i);
});

test("includes legal routes", async () => {
  const [privacy, terms] = await Promise.all([readFile(new URL("app/privacidad/page.tsx", root), "utf8"), readFile(new URL("app/terminos/page.tsx", root), "utf8")]);
  assert.match(privacy, /Aviso de privacidad/);
  assert.match(terms, /Términos de uso/);
});

test("routes landing access actions through real public pages", async () => {
  const landing = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(landing, /href="\/iniciar-sesion"/);
  assert.match(landing, /href="\/registro"/);
  assert.doesNotMatch(landing, /href="\/signin-with-chatgpt/);
  const routes = ["iniciar-sesion", "registro", "verificar-correo", "olvide-mi-contrasena", "restablecer-contrasena", "cerrar-sesion"];
  await Promise.all(routes.map((route) => readFile(new URL(`app/${route}/page.tsx`, root), "utf8")));
});

test("keeps every application control attached to an action", async () => {
  const source = await readFile(new URL("app/components/YucaFishApp.tsx", root), "utf8");
  assert.doesNotMatch(source, /<button className="icon-button"><\/button>/);
  assert.match(source, /onClick=\{notify\}/);
  assert.match(source, /deletePhoto/);
  assert.match(source, /data-add-fish="true"/);
  assert.match(source, /Clima y mar/);
  assert.match(source, /Guardar las condiciones de esta salida/);
  assert.match(source, /Open-Meteo/);
});

test("keeps Open-Meteo requests on protected backend routes", async () => {
  const source = await readFile(new URL("app/components/YucaFishApp.tsx", root), "utf8");
  assert.doesNotMatch(source, /api\.open-meteo\.com|marine-api\.open-meteo\.com/);
  const client = await readFile(new URL("lib/weather/client.ts", root), "utf8");
  assert.match(client, /buildWeatherUrl/);
  assert.match(client, /AbortController/);
  assert.match(client, /cell_selection/);
});

test("includes required PWA assets", async () => {
  const { access } = await import("node:fs/promises");
  await Promise.all([access(new URL("public/manifest.webmanifest", root)), access(new URL("public/favicon.svg", root)), access(new URL("public/og.png", root))]);
});

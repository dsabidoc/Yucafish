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

test("includes required PWA assets", async () => {
  const { access } = await import("node:fs/promises");
  await Promise.all([access(new URL("public/manifest.webmanifest", root)), access(new URL("public/favicon.svg", root)), access(new URL("public/og.png", root))]);
});

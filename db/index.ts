export function getDb() {
  throw new Error(
    "La integración directa de Drizzle no se usa en runtime. GoFishing.mx opera exclusivamente con MySQL mediante DATABASE_URL.",
  );
}

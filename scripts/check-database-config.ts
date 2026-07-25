const value = (process.env.DATABASE_URL || "").trim();

if (!value) {
  console.error(
    "DATABASE_URL es obligatoria. Este proyecto usa exclusivamente MySQL y no admite SQLite ni fallbacks locales.",
  );
  process.exit(1);
}

if (value.startsWith("file:")) {
  console.error(
    "DATABASE_URL apunta a un archivo local (file:). Eso está prohibido en este proyecto.",
  );
  process.exit(1);
}

if (!value.startsWith("mysql://")) {
  console.error(
    "DATABASE_URL debe comenzar con mysql://. No se admiten SQLite ni otros providers.",
  );
  process.exit(1);
}

let parsed: URL;
try {
  parsed = new URL(value);
} catch {
  console.error("DATABASE_URL no es una URL válida.");
  process.exit(1);
}

if (parsed.protocol !== "mysql:") {
  console.error(
    "DATABASE_URL debe usar el protocolo mysql://. No se admiten sqlite, file: ni otros drivers.",
  );
  process.exit(1);
}

if (!parsed.username || !parsed.hostname || !parsed.pathname || parsed.pathname === "/") {
  console.error(
    "DATABASE_URL está incompleta. Debe incluir usuario, host, puerto y base de datos.",
  );
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && parsed.pathname.slice(1) !== "yucafish") {
  console.error(
    "En producción, DATABASE_URL debe apuntar a la base de datos yucafish.",
  );
  process.exit(1);
}

console.log("DATABASE_URL válida para MySQL.");

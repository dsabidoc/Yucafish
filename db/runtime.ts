import { env } from "cloudflare:workers";

type D1Result<T = unknown> = { results?: T[]; success: boolean };
type Statement = { bind: (...values: unknown[]) => Statement; run: () => Promise<D1Result>; all: <T = unknown>() => Promise<D1Result<T>>; first: <T = unknown>() => Promise<T | null> };
export type D1 = { prepare: (sql: string) => Statement; batch: (items: Statement[]) => Promise<D1Result[]> };

export function database(): D1 {
  const db = (env as unknown as { DB?: D1 }).DB;
  if (!db) throw new Error("La base de datos no está disponible");
  return db;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS profiles (email TEXT PRIMARY KEY, display_name TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'Yucatán', country TEXT NOT NULL DEFAULT 'México', timezone TEXT NOT NULL DEFAULT 'America/Merida', weight_unit TEXT NOT NULL DEFAULT 'kg', role TEXT NOT NULL DEFAULT 'USER', status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fishing_trips (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, title TEXT NOT NULL, port TEXT NOT NULL, fishing_date TEXT NOT NULL, departure_time TEXT, return_time TEXT, area TEXT, vessel TEXT, captain TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'DRAFT', cover_image_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS trips_owner_date_idx ON fishing_trips(owner_email, fishing_date)`,
  `CREATE TABLE IF NOT EXISTS catches (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL, owner_email TEXT NOT NULL, species TEXT NOT NULL, custom_species INTEGER NOT NULL DEFAULT 0, weight_kg REAL NOT NULL CHECK(weight_kg > 0 AND weight_kg <= 1000), original_weight REAL NOT NULL, original_unit TEXT NOT NULL, release_status TEXT NOT NULL DEFAULT 'UNSPECIFIED', length_cm REAL, caught_at TEXT, lure TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, FOREIGN KEY(trip_id) REFERENCES fishing_trips(id))`,
  `CREATE INDEX IF NOT EXISTS catches_trip_idx ON catches(trip_id, deleted_at)`,
  `CREATE TABLE IF NOT EXISTS media_assets (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, trip_id TEXT, catch_id TEXT, storage_key TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, alt_text TEXT, created_at TEXT NOT NULL, deleted_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS media_owner_idx ON media_assets(owner_email, catch_id)`,
  `CREATE TABLE IF NOT EXISTS species (id TEXT PRIMARY KEY, common_name TEXT NOT NULL, aliases TEXT NOT NULL DEFAULT '', scientific_name TEXT, slug TEXT NOT NULL UNIQUE, icon_key TEXT NOT NULL DEFAULT 'fish', sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS ports (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL DEFAULT 'PUERTO', municipality TEXT, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_email_hash TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, created_at TEXT NOT NULL)`,
];

const speciesSeed = ["Mero", "Negrillo", "Abadejo", "Cherna", "Jurel", "Coronado", "Barracuda", "Robalo", "Sábalo", "Pargo", "Huachinango", "Rubia", "Boquinete", "Sierra", "Cazón", "Bonito", "Atún", "Dorado", "Pez vela", "Pez espada", "Marlín", "Macabí", "Pámpano", "Bagre marino", "Mojarra", "Chucumite", "Otro"];
const portSeed = ["Progreso", "Yucalpetén", "Chicxulub Puerto", "Telchac Puerto", "Dzilam de Bravo", "San Felipe", "Río Lagartos", "El Cuyo", "Sisal", "Celestún", "Chuburná Puerto", "Chelem", "Otro"];

export async function ensureDatabase() {
  const db = database();
  for (const sql of schemaStatements) await db.prepare(sql).run();
  const row = await db.prepare("SELECT COUNT(*) AS count FROM species").first<{ count: number }>();
  if (!row?.count) {
    const inserts = speciesSeed.map((name, i) => db.prepare("INSERT OR IGNORE INTO species (id, common_name, aliases, slug, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)").bind(crypto.randomUUID(), name, name === "Jurel" ? "curél,curel" : "", slugify(name), i));
    const ports = portSeed.map((name, i) => db.prepare("INSERT OR IGNORE INTO ports (id, name, slug, type, municipality, sort_order, active) VALUES (?, ?, ?, 'PUERTO', ?, ?, 1)").bind(crypto.randomUUID(), name, slugify(name), name === "Otro" ? null : name, i));
    await db.batch([...inserts, ...ports]);
  }
}

export function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function now() { return new Date().toISOString(); }

export function mapRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  return out;
}

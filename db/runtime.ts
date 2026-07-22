import { env } from "cloudflare:workers";
import { yucatanPorts } from "./seeds/yucatan-ports";

type D1Result<T = unknown> = { results?: T[]; success: boolean };
type Statement = {
  bind: (...values: unknown[]) => Statement;
  run: () => Promise<D1Result>;
  all: <T = unknown>() => Promise<D1Result<T>>;
  first: <T = unknown>() => Promise<T | null>;
};
export type D1 = {
  prepare: (sql: string) => Statement;
  batch: (items: Statement[]) => Promise<D1Result[]>;
};

export function database(): D1 {
  const db = (env as unknown as { DB?: D1 }).DB;
  if (!db) throw new Error("La base de datos no está disponible");
  return db;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS profiles (email TEXT PRIMARY KEY, display_name TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'Yucatán', country TEXT NOT NULL DEFAULT 'México', timezone TEXT NOT NULL DEFAULT 'America/Merida', weight_unit TEXT NOT NULL DEFAULT 'kg', role TEXT NOT NULL DEFAULT 'USER', status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fishing_trips (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, title TEXT NOT NULL, port TEXT NOT NULL, departure_location_id TEXT, fishing_date TEXT NOT NULL, departure_time TEXT, return_time TEXT, area TEXT, vessel TEXT, captain TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'DRAFT', cover_image_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS trips_owner_date_idx ON fishing_trips(owner_email, fishing_date)`,
  `CREATE TABLE IF NOT EXISTS catches (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL, owner_email TEXT NOT NULL, species TEXT NOT NULL, custom_species INTEGER NOT NULL DEFAULT 0, weight_kg REAL NOT NULL CHECK(weight_kg > 0 AND weight_kg <= 1000), original_weight REAL NOT NULL, original_unit TEXT NOT NULL, release_status TEXT NOT NULL DEFAULT 'UNSPECIFIED', length_cm REAL, caught_at TEXT, lure TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, FOREIGN KEY(trip_id) REFERENCES fishing_trips(id))`,
  `CREATE INDEX IF NOT EXISTS catches_trip_idx ON catches(trip_id, deleted_at)`,
  `CREATE TABLE IF NOT EXISTS media_assets (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, trip_id TEXT, catch_id TEXT, storage_key TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, alt_text TEXT, created_at TEXT NOT NULL, deleted_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS media_owner_idx ON media_assets(owner_email, catch_id)`,
  `CREATE TABLE IF NOT EXISTS species (id TEXT PRIMARY KEY, common_name TEXT NOT NULL, aliases TEXT NOT NULL DEFAULT '', scientific_name TEXT, slug TEXT NOT NULL UNIQUE, icon_key TEXT NOT NULL DEFAULT 'fish', sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS ports (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL DEFAULT 'PUERTO', municipality TEXT, state TEXT NOT NULL DEFAULT 'Yucatán', country TEXT NOT NULL DEFAULT 'México', latitude REAL, longitude REAL, marine_latitude REAL, marine_longitude REAL, timezone TEXT NOT NULL DEFAULT 'America/Merida', is_weather_enabled INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS weather_cache (id TEXT PRIMARY KEY, location_id TEXT NOT NULL, forecast_type TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'open-meteo', payload_json TEXT NOT NULL, fetched_at TEXT NOT NULL, expires_at TEXT NOT NULL, stale_until TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(location_id, forecast_type, provider))`,
  `CREATE INDEX IF NOT EXISTS weather_cache_expiry_idx ON weather_cache(stale_until)`,
  `CREATE TABLE IF NOT EXISTS fishing_trip_weather_snapshots (id TEXT PRIMARY KEY, fishing_trip_id TEXT NOT NULL UNIQUE, location_id TEXT NOT NULL, captured_at TEXT NOT NULL, snapshot_type TEXT NOT NULL, provider TEXT NOT NULL, provider_model TEXT, latitude REAL NOT NULL, longitude REAL NOT NULL, marine_latitude REAL, marine_longitude REAL, timezone TEXT NOT NULL, temperature_c REAL, apparent_temperature_c REAL, humidity_percent REAL, precipitation_mm REAL, precipitation_probability_percent REAL, weather_code INTEGER, cloud_cover_percent REAL, visibility_meters REAL, wind_speed_kmh REAL, wind_direction_degrees REAL, wind_gust_kmh REAL, wave_height_meters REAL, wave_direction_degrees REAL, wave_period_seconds REAL, swell_height_meters REAL, swell_direction_degrees REAL, swell_period_seconds REAL, sea_surface_temperature_c REAL, ocean_current_velocity_kmh REAL, ocean_current_direction_degrees REAL, raw_provider_reference TEXT, created_at TEXT NOT NULL, FOREIGN KEY(fishing_trip_id) REFERENCES fishing_trips(id), FOREIGN KEY(location_id) REFERENCES ports(id))`,
  `CREATE TABLE IF NOT EXISTS fishing_condition_thresholds (id TEXT PRIMARY KEY, region TEXT NOT NULL UNIQUE, maximum_favorable_wind_kmh REAL NOT NULL, maximum_caution_wind_kmh REAL NOT NULL, maximum_favorable_gust_kmh REAL NOT NULL, maximum_caution_gust_kmh REAL NOT NULL, maximum_favorable_wave_meters REAL NOT NULL, maximum_caution_wave_meters REAL NOT NULL, minimum_favorable_wave_period_seconds REAL NOT NULL, active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, updated_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS weather_rate_limits (id TEXT PRIMARY KEY, rate_key TEXT NOT NULL UNIQUE, window_start TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_email_hash TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, created_at TEXT NOT NULL)`,
];

const speciesSeed = [
  "Mero",
  "Negrillo",
  "Abadejo",
  "Cherna",
  "Jurel",
  "Coronado",
  "Barracuda",
  "Robalo",
  "Sábalo",
  "Pargo",
  "Huachinango",
  "Rubia",
  "Boquinete",
  "Sierra",
  "Cazón",
  "Bonito",
  "Atún",
  "Dorado",
  "Pez vela",
  "Pez espada",
  "Marlín",
  "Macabí",
  "Pámpano",
  "Bagre marino",
  "Mojarra",
  "Chucumite",
  "Otro",
];
const portSeed = [
  "Progreso",
  "Yucalpetén",
  "Chicxulub Puerto",
  "Telchac Puerto",
  "Dzilam de Bravo",
  "San Felipe",
  "Río Lagartos",
  "El Cuyo",
  "Sisal",
  "Celestún",
  "Chuburná Puerto",
  "Chelem",
  "Otro",
];

async function ensureColumn(table: string, column: string, definition: string) {
  const rows =
    (
      await database()
        .prepare(`PRAGMA table_info(${table})`)
        .all<{ name: string }>()
    ).results ?? [];
  if (!rows.some((row) => row.name === column))
    await database()
      .prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
      .run();
}

export async function ensureDatabase() {
  const db = database();
  for (const sql of schemaStatements) await db.prepare(sql).run();
  await ensureColumn("fishing_trips", "departure_location_id", "TEXT");
  const portColumns: Array<[string, string]> = [
    ["state", "TEXT NOT NULL DEFAULT 'Yucatán'"],
    ["country", "TEXT NOT NULL DEFAULT 'México'"],
    ["latitude", "REAL"],
    ["longitude", "REAL"],
    ["marine_latitude", "REAL"],
    ["marine_longitude", "REAL"],
    ["timezone", "TEXT NOT NULL DEFAULT 'America/Merida'"],
    ["is_weather_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["created_at", "TEXT NOT NULL DEFAULT ''"],
    ["updated_at", "TEXT NOT NULL DEFAULT ''"],
  ];
  for (const [column, definition] of portColumns)
    await ensureColumn("ports", column, definition);
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM species")
    .first<{ count: number }>();
  if (!row?.count) {
    const inserts = speciesSeed.map((name, i) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO species (id, common_name, aliases, slug, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)",
        )
        .bind(
          crypto.randomUUID(),
          name,
          name === "Jurel" ? "curél,curel" : "",
          slugify(name),
          i,
        ),
    );
    await db.batch(inserts);
  }
  const timestamp = now();
  const existingPorts =
    (await db.prepare("SELECT slug FROM ports").all<{ slug: string }>())
      .results ?? [];
  const existingSlugs = new Set(existingPorts.map((port) => port.slug));
  const inserts = portSeed
    .filter((name) => !existingSlugs.has(slugify(name)))
    .map((name, i) =>
      db
        .prepare(
          "INSERT INTO ports (id, name, slug, type, municipality, sort_order, active, created_at, updated_at) VALUES (?, ?, ?, 'PUERTO', ?, ?, 1, ?, ?)",
        )
        .bind(
          crypto.randomUUID(),
          name,
          slugify(name),
          name === "Otro" ? null : name,
          i,
          timestamp,
          timestamp,
        ),
    );
  if (inserts.length) await db.batch(inserts);
  for (const [index, port] of yucatanPorts.entries()) {
    await db
      .prepare(
        "UPDATE ports SET name=?, municipality=?, state='Yucatán', country='México', latitude=?, longitude=?, marine_latitude=?, marine_longitude=?, timezone='America/Merida', is_weather_enabled=1, sort_order=?, active=1, updated_at=? WHERE slug=?",
      )
      .bind(
        port.name,
        port.municipality,
        port.latitude,
        port.longitude,
        port.marineLatitude,
        port.marineLongitude,
        index,
        timestamp,
        port.slug,
      )
      .run();
  }
  await db
    .prepare(
      "UPDATE fishing_trips SET departure_location_id=(SELECT id FROM ports WHERE ports.name=fishing_trips.port LIMIT 1) WHERE departure_location_id IS NULL",
    )
    .run();
  await db
    .prepare(
      "INSERT OR IGNORE INTO fishing_condition_thresholds (id, region, maximum_favorable_wind_kmh, maximum_caution_wind_kmh, maximum_favorable_gust_kmh, maximum_caution_gust_kmh, maximum_favorable_wave_meters, maximum_caution_wave_meters, minimum_favorable_wave_period_seconds, active, updated_at) VALUES (?, 'Yucatán', 25, 40, 35, 55, 1.2, 2.0, 5, 1, ?)",
    )
    .bind(crypto.randomUUID(), timestamp)
    .run();
  await db
    .prepare(
      "DELETE FROM weather_cache WHERE stale_until < datetime('now', '-1 day')",
    )
    .run();
  await db
    .prepare(
      "DELETE FROM weather_rate_limits WHERE updated_at < datetime('now', '-1 day')",
    )
    .run();
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function now() {
  return new Date().toISOString();
}

export function mapRow<T extends Record<string, unknown>>(
  row: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row))
    out[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  return out;
}

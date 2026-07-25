import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import mysql from "mysql2/promise";
import type {
  Pool,
  PoolConnection,
  QueryResult,
  ResultSetHeader,
} from "mysql2/promise";
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

type PreparedState = {
  sql: string;
  values: SQLInputValue[];
};

type InternalStatement = Statement & {
  __state: PreparedState;
};

type Driver = "sqlite" | "mysql";

function activeDriver(): Driver {
  const configured = (
    process.env.GOFISHING_DB_CLIENT ||
    process.env.DB_CLIENT ||
    ""
  )
    .trim()
    .toLowerCase();
  if (configured === "mysql" || configured === "mariadb") return "mysql";
  if (
    process.env.GOFISHING_DB_HOST ||
    process.env.DB_HOST ||
    process.env.DATABASE_URL
  )
    return "mysql";
  return "sqlite";
}

function storageRoot() {
  const root =
    process.env.GOFISHING_STORAGE_DIR ||
    process.env.STORAGE_DIR ||
    path.join(/*turbopackIgnore: true*/ process.cwd(), "storage");
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

function databaseFile() {
  return path.join(storageRoot(), "gofishing.sqlite");
}

let sqlite: DatabaseSync | null = null;
let mysqlPool: Pool | null = null;

function getSqlite() {
  if (sqlite) return sqlite;
  sqlite = new DatabaseSync(databaseFile());
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec("PRAGMA busy_timeout = 5000");
  return sqlite;
}

function getMysqlPool() {
  if (mysqlPool) return mysqlPool;
  const host = process.env.GOFISHING_DB_HOST || process.env.DB_HOST;
  const user = process.env.GOFISHING_DB_USER || process.env.DB_USER;
  const password =
    process.env.GOFISHING_DB_PASSWORD || process.env.DB_PASSWORD;
  const database = process.env.GOFISHING_DB_NAME || process.env.DB_NAME;
  const port = Number(
    process.env.GOFISHING_DB_PORT || process.env.DB_PORT || "3306",
  );
  if (!host || !user || !database)
    throw new Error(
      "Faltan variables de MySQL: GOFISHING_DB_HOST, GOFISHING_DB_USER y GOFISHING_DB_NAME.",
    );
  mysqlPool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
  });
  return mysqlPool;
}

function normalizeParam(value: unknown) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === undefined) return null;
  return value as SQLInputValue;
}

async function mysqlRun(
  state: PreparedState,
  connection?: PoolConnection,
): Promise<ResultSetHeader> {
  const executor = connection ?? getMysqlPool();
  const [result] = await executor.execute<QueryResult>(
    state.sql,
    state.values as never[],
  );
  return result as ResultSetHeader;
}

async function mysqlAll<T = unknown>(
  state: PreparedState,
  connection?: PoolConnection,
): Promise<T[]> {
  const executor = connection ?? getMysqlPool();
  const [rows] = await executor.query<QueryResult>(
    state.sql,
    state.values as never[],
  );
  return rows as T[];
}

function createStatement(state: PreparedState): InternalStatement {
  return {
    __state: state,
    bind: (...values: unknown[]) =>
      createStatement({
        sql: state.sql,
        values: values.map(normalizeParam),
      }),
    async run() {
      if (activeDriver() === "mysql") {
        await mysqlRun(state);
        return { success: true };
      }
      getSqlite().prepare(state.sql).run(...state.values);
      return { success: true };
    },
    async all<T = unknown>() {
      if (activeDriver() === "mysql") {
        const results = await mysqlAll<T>(state);
        return { success: true, results };
      }
      const results = getSqlite().prepare(state.sql).all(...state.values) as T[];
      return { success: true, results };
    },
    async first<T = unknown>() {
      if (activeDriver() === "mysql") {
        const rows = await mysqlAll<T>(state);
        return rows[0] ?? null;
      }
      const result = getSqlite().prepare(state.sql).get(...state.values) as
        | T
        | undefined;
      return result ?? null;
    },
  };
}

export function database(): D1 {
  return {
    prepare(sql: string) {
      return createStatement({ sql, values: [] });
    },
    async batch(items: Statement[]) {
      if (activeDriver() === "mysql") {
        const connection = await getMysqlPool().getConnection();
        try {
          await connection.beginTransaction();
          const results: D1Result[] = [];
          for (const item of items) {
            const internal = item as InternalStatement;
            await mysqlRun(internal.__state, connection);
            results.push({ success: true });
          }
          await connection.commit();
          return results;
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      }
      const db = getSqlite();
      db.exec("BEGIN");
      try {
        const results: D1Result[] = [];
        for (const item of items) results.push(await item.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

const sqliteSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS profiles (email TEXT PRIMARY KEY, display_name TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'Yucatán', country TEXT NOT NULL DEFAULT 'México', timezone TEXT NOT NULL DEFAULT 'America/Merida', weight_unit TEXT NOT NULL DEFAULT 'kg', role TEXT NOT NULL DEFAULT 'USER', status TEXT NOT NULL DEFAULT 'ACTIVE', password_hash TEXT, public_slug TEXT UNIQUE, public_profile_enabled INTEGER NOT NULL DEFAULT 1, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fishing_trips (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, title TEXT NOT NULL, port TEXT NOT NULL, departure_location_id TEXT, fishing_date TEXT NOT NULL, departure_time TEXT, return_time TEXT, area TEXT, vessel TEXT, captain TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'DRAFT', cover_image_url TEXT, public_share INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS trips_owner_date_idx ON fishing_trips(owner_email, fishing_date)`,
  `CREATE TABLE IF NOT EXISTS catches (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL, owner_email TEXT NOT NULL, species TEXT NOT NULL, custom_species INTEGER NOT NULL DEFAULT 0, weight_kg REAL NOT NULL CHECK(weight_kg > 0 AND weight_kg <= 1000), original_weight REAL NOT NULL, original_unit TEXT NOT NULL, release_status TEXT NOT NULL DEFAULT 'UNSPECIFIED', length_cm REAL, caught_at TEXT, lure TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, FOREIGN KEY(trip_id) REFERENCES fishing_trips(id))`,
  `CREATE INDEX IF NOT EXISTS catches_trip_idx ON catches(trip_id, deleted_at)`,
  `CREATE TABLE IF NOT EXISTS media_assets (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, trip_id TEXT, catch_id TEXT, storage_key TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, alt_text TEXT, created_at TEXT NOT NULL, deleted_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS media_owner_idx ON media_assets(owner_email, catch_id)`,
  `CREATE TABLE IF NOT EXISTS species (id TEXT PRIMARY KEY, common_name TEXT NOT NULL, aliases TEXT NOT NULL DEFAULT '', scientific_name TEXT, slug TEXT NOT NULL UNIQUE, icon_key TEXT NOT NULL DEFAULT 'fish', sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS ports (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL DEFAULT 'PUERTO', municipality TEXT, state TEXT NOT NULL DEFAULT 'Yucatán', state_code TEXT NOT NULL DEFAULT 'YUC', country TEXT NOT NULL DEFAULT 'México', country_code TEXT NOT NULL DEFAULT 'MX', latitude REAL, longitude REAL, marine_latitude REAL, marine_longitude REAL, timezone TEXT NOT NULL DEFAULT 'America/Merida', is_weather_enabled INTEGER NOT NULL DEFAULT 0, tide_check_enabled INTEGER NOT NULL DEFAULT 0, tide_check_station_id TEXT, tide_check_station_name TEXT, tide_check_station_latitude REAL, tide_check_station_longitude REAL, tide_check_station_state TEXT, tide_check_station_country TEXT, station_verified_at TEXT, station_verified_by TEXT, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS weather_cache (id TEXT PRIMARY KEY, location_id TEXT NOT NULL, forecast_type TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'open-meteo', payload_json TEXT NOT NULL, fetched_at TEXT NOT NULL, expires_at TEXT NOT NULL, stale_until TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(location_id, forecast_type, provider))`,
  `CREATE INDEX IF NOT EXISTS weather_cache_expiry_idx ON weather_cache(stale_until)`,
  `CREATE TABLE IF NOT EXISTS fishing_trip_weather_snapshots (id TEXT PRIMARY KEY, fishing_trip_id TEXT NOT NULL UNIQUE, location_id TEXT NOT NULL, captured_at TEXT NOT NULL, snapshot_type TEXT NOT NULL, provider TEXT NOT NULL, provider_model TEXT, latitude REAL NOT NULL, longitude REAL NOT NULL, marine_latitude REAL, marine_longitude REAL, timezone TEXT NOT NULL, temperature_c REAL, apparent_temperature_c REAL, humidity_percent REAL, precipitation_mm REAL, precipitation_probability_percent REAL, weather_code INTEGER, cloud_cover_percent REAL, visibility_meters REAL, wind_speed_kmh REAL, wind_direction_degrees REAL, wind_gust_kmh REAL, wave_height_meters REAL, wave_direction_degrees REAL, wave_period_seconds REAL, swell_height_meters REAL, swell_direction_degrees REAL, swell_period_seconds REAL, sea_surface_temperature_c REAL, ocean_current_velocity_kmh REAL, ocean_current_direction_degrees REAL, raw_provider_reference TEXT, created_at TEXT NOT NULL, FOREIGN KEY(fishing_trip_id) REFERENCES fishing_trips(id), FOREIGN KEY(location_id) REFERENCES ports(id))`,
  `CREATE TABLE IF NOT EXISTS fishing_condition_thresholds (id TEXT PRIMARY KEY, region TEXT NOT NULL UNIQUE, maximum_favorable_wind_kmh REAL NOT NULL, maximum_caution_wind_kmh REAL NOT NULL, maximum_favorable_gust_kmh REAL NOT NULL, maximum_caution_gust_kmh REAL NOT NULL, maximum_favorable_wave_meters REAL NOT NULL, maximum_caution_wave_meters REAL NOT NULL, minimum_favorable_wave_period_seconds REAL NOT NULL, active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, updated_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS weather_rate_limits (id TEXT PRIMARY KEY, rate_key TEXT NOT NULL UNIQUE, window_start TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_email_hash TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS account_tokens (id TEXT PRIMARY KEY, email TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, type TEXT NOT NULL, pending_email TEXT, reason TEXT, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL)`,
];

const mysqlSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS profiles (email VARCHAR(255) PRIMARY KEY, display_name VARCHAR(255) NOT NULL, first_name VARCHAR(255) NOT NULL DEFAULT '', last_name VARCHAR(255) NOT NULL DEFAULT '', city VARCHAR(255) NOT NULL DEFAULT '', state VARCHAR(255) NOT NULL DEFAULT 'Yucatán', country VARCHAR(255) NOT NULL DEFAULT 'México', timezone VARCHAR(100) NOT NULL DEFAULT 'America/Merida', weight_unit VARCHAR(16) NOT NULL DEFAULT 'kg', role VARCHAR(16) NOT NULL DEFAULT 'USER', status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', password_hash TEXT NULL, public_slug VARCHAR(255) NULL, public_profile_enabled TINYINT(1) NOT NULL DEFAULT 1, avatar_url TEXT NULL, created_at VARCHAR(64) NOT NULL, updated_at VARCHAR(64) NOT NULL, UNIQUE KEY profiles_public_slug_unique (public_slug)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS fishing_trips (id CHAR(36) PRIMARY KEY, owner_email VARCHAR(255) NOT NULL, title VARCHAR(255) NOT NULL, port VARCHAR(255) NOT NULL, departure_location_id CHAR(36) NULL, fishing_date VARCHAR(32) NOT NULL, departure_time VARCHAR(32) NULL, return_time VARCHAR(32) NULL, area VARCHAR(255) NULL, vessel VARCHAR(255) NULL, captain VARCHAR(255) NULL, notes TEXT NULL, status VARCHAR(16) NOT NULL DEFAULT 'DRAFT', cover_image_url TEXT NULL, public_share TINYINT(1) NOT NULL DEFAULT 0, created_at VARCHAR(64) NOT NULL, updated_at VARCHAR(64) NOT NULL, deleted_at VARCHAR(64) NULL, INDEX trips_owner_date_idx (owner_email, fishing_date)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS catches (id CHAR(36) PRIMARY KEY, trip_id CHAR(36) NOT NULL, owner_email VARCHAR(255) NOT NULL, species VARCHAR(255) NOT NULL, custom_species TINYINT(1) NOT NULL DEFAULT 0, weight_kg DOUBLE NOT NULL, original_weight DOUBLE NOT NULL, original_unit VARCHAR(16) NOT NULL, release_status VARCHAR(32) NOT NULL DEFAULT 'UNSPECIFIED', length_cm DOUBLE NULL, caught_at VARCHAR(64) NULL, lure VARCHAR(255) NULL, notes TEXT NULL, created_at VARCHAR(64) NOT NULL, updated_at VARCHAR(64) NOT NULL, deleted_at VARCHAR(64) NULL, INDEX catches_trip_idx (trip_id, deleted_at), CONSTRAINT catches_trip_fk FOREIGN KEY (trip_id) REFERENCES fishing_trips(id)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS media_assets (id CHAR(36) PRIMARY KEY, owner_email VARCHAR(255) NOT NULL, trip_id CHAR(36) NULL, catch_id CHAR(36) NULL, storage_key VARCHAR(768) NOT NULL, mime_type VARCHAR(128) NOT NULL, size_bytes BIGINT NOT NULL, alt_text TEXT NULL, created_at VARCHAR(64) NOT NULL, deleted_at VARCHAR(64) NULL, UNIQUE KEY media_storage_key_unique (storage_key), INDEX media_owner_idx (owner_email, catch_id)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS species (id CHAR(36) PRIMARY KEY, common_name VARCHAR(255) NOT NULL, aliases TEXT NOT NULL, scientific_name VARCHAR(255) NULL, slug VARCHAR(255) NOT NULL, icon_key VARCHAR(64) NOT NULL DEFAULT 'fish', sort_order INT NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1, UNIQUE KEY species_slug_unique (slug)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS ports (id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL, type VARCHAR(32) NOT NULL DEFAULT 'PUERTO', municipality VARCHAR(255) NULL, state VARCHAR(255) NOT NULL DEFAULT 'Yucatán', state_code VARCHAR(16) NOT NULL DEFAULT 'YUC', country VARCHAR(255) NOT NULL DEFAULT 'México', country_code VARCHAR(16) NOT NULL DEFAULT 'MX', latitude DOUBLE NULL, longitude DOUBLE NULL, marine_latitude DOUBLE NULL, marine_longitude DOUBLE NULL, timezone VARCHAR(100) NOT NULL DEFAULT 'America/Merida', is_weather_enabled TINYINT(1) NOT NULL DEFAULT 0, tide_check_enabled TINYINT(1) NOT NULL DEFAULT 0, tide_check_station_id VARCHAR(128) NULL, tide_check_station_name VARCHAR(255) NULL, tide_check_station_latitude DOUBLE NULL, tide_check_station_longitude DOUBLE NULL, tide_check_station_state VARCHAR(255) NULL, tide_check_station_country VARCHAR(255) NULL, station_verified_at VARCHAR(64) NULL, station_verified_by VARCHAR(255) NULL, sort_order INT NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1, created_at VARCHAR(64) NOT NULL DEFAULT '', updated_at VARCHAR(64) NOT NULL DEFAULT '', UNIQUE KEY ports_slug_unique (slug)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS weather_cache (id CHAR(36) PRIMARY KEY, location_id CHAR(36) NOT NULL, forecast_type VARCHAR(64) NOT NULL, provider VARCHAR(64) NOT NULL DEFAULT 'open-meteo', payload_json LONGTEXT NOT NULL, fetched_at VARCHAR(64) NOT NULL, expires_at VARCHAR(64) NOT NULL, stale_until VARCHAR(64) NOT NULL, created_at VARCHAR(64) NOT NULL, updated_at VARCHAR(64) NOT NULL, UNIQUE KEY weather_cache_unique (location_id, forecast_type, provider), INDEX weather_cache_expiry_idx (stale_until)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS fishing_trip_weather_snapshots (id CHAR(36) PRIMARY KEY, fishing_trip_id CHAR(36) NOT NULL, location_id CHAR(36) NOT NULL, captured_at VARCHAR(64) NOT NULL, snapshot_type VARCHAR(64) NOT NULL, provider VARCHAR(64) NOT NULL, provider_model VARCHAR(128) NULL, latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL, marine_latitude DOUBLE NULL, marine_longitude DOUBLE NULL, timezone VARCHAR(100) NOT NULL, temperature_c DOUBLE NULL, apparent_temperature_c DOUBLE NULL, humidity_percent DOUBLE NULL, precipitation_mm DOUBLE NULL, precipitation_probability_percent DOUBLE NULL, weather_code INT NULL, cloud_cover_percent DOUBLE NULL, visibility_meters DOUBLE NULL, wind_speed_kmh DOUBLE NULL, wind_direction_degrees DOUBLE NULL, wind_gust_kmh DOUBLE NULL, wave_height_meters DOUBLE NULL, wave_direction_degrees DOUBLE NULL, wave_period_seconds DOUBLE NULL, swell_height_meters DOUBLE NULL, swell_direction_degrees DOUBLE NULL, swell_period_seconds DOUBLE NULL, sea_surface_temperature_c DOUBLE NULL, ocean_current_velocity_kmh DOUBLE NULL, ocean_current_direction_degrees DOUBLE NULL, raw_provider_reference TEXT NULL, created_at VARCHAR(64) NOT NULL, UNIQUE KEY fishing_trip_weather_snapshots_trip_unique (fishing_trip_id), CONSTRAINT fishing_trip_weather_snapshots_trip_fk FOREIGN KEY (fishing_trip_id) REFERENCES fishing_trips(id), CONSTRAINT fishing_trip_weather_snapshots_location_fk FOREIGN KEY (location_id) REFERENCES ports(id)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS fishing_condition_thresholds (id CHAR(36) PRIMARY KEY, region VARCHAR(255) NOT NULL, maximum_favorable_wind_kmh DOUBLE NOT NULL, maximum_caution_wind_kmh DOUBLE NOT NULL, maximum_favorable_gust_kmh DOUBLE NOT NULL, maximum_caution_gust_kmh DOUBLE NOT NULL, maximum_favorable_wave_meters DOUBLE NOT NULL, maximum_caution_wave_meters DOUBLE NOT NULL, minimum_favorable_wave_period_seconds DOUBLE NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, updated_at VARCHAR(64) NOT NULL, updated_by VARCHAR(255) NULL, UNIQUE KEY fishing_condition_thresholds_region_unique (region)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS weather_rate_limits (id CHAR(36) PRIMARY KEY, rate_key VARCHAR(255) NOT NULL, window_start VARCHAR(64) NOT NULL, count INT NOT NULL DEFAULT 1, updated_at VARCHAR(64) NOT NULL, UNIQUE KEY weather_rate_limits_rate_key_unique (rate_key)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id CHAR(36) PRIMARY KEY, actor_email_hash VARCHAR(255) NOT NULL, action VARCHAR(128) NOT NULL, entity_type VARCHAR(128) NOT NULL, entity_id VARCHAR(255) NULL, created_at VARCHAR(64) NOT NULL) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS account_tokens (id CHAR(36) PRIMARY KEY, email VARCHAR(255) NOT NULL, token_hash VARCHAR(255) NOT NULL, type VARCHAR(64) NOT NULL, pending_email VARCHAR(255) NULL, reason TEXT NULL, expires_at VARCHAR(64) NOT NULL, used_at VARCHAR(64) NULL, created_at VARCHAR(64) NOT NULL, UNIQUE KEY account_tokens_hash_unique (token_hash)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
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
  "Uaymitún",
  "San Benito",
  "San Bruno",
  "Telchac Puerto",
  "San Crisanto",
  "Chabihau",
  "Santa Clara",
  "Dzilam de Bravo",
  "San Felipe",
  "Río Lagartos",
  "Las Coloradas",
  "El Cuyo",
  "Sisal",
  "Celestún",
  "Chuburná Puerto",
  "Chelem",
  "Otro",
];

async function ensureColumn(table: string, column: string, definition: string) {
  if (activeDriver() === "mysql") {
    const existing = await database()
      .prepare(
        "SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      )
      .bind(table, column)
      .first<{ name: string }>();
    if (!existing)
      await database()
        .prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
        .run();
    return;
  }

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
  const driver = activeDriver();
  const schemaStatements =
    driver === "mysql" ? mysqlSchemaStatements : sqliteSchemaStatements;

  for (const sql of schemaStatements) await db.prepare(sql).run();

  await ensureColumn(
    "profiles",
    "password_hash",
    driver === "mysql" ? "TEXT NULL" : "TEXT",
  );
  await ensureColumn(
    "profiles",
    "public_slug",
    driver === "mysql" ? "VARCHAR(255) NULL" : "TEXT",
  );
  await ensureColumn(
    "profiles",
    "public_profile_enabled",
    driver === "mysql" ? "TINYINT(1) NOT NULL DEFAULT 1" : "INTEGER NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    "profiles",
    "avatar_url",
    driver === "mysql" ? "TEXT NULL" : "TEXT",
  );
  await ensureColumn(
    "fishing_trips",
    "departure_location_id",
    driver === "mysql" ? "CHAR(36) NULL" : "TEXT",
  );
  await ensureColumn(
    "fishing_trips",
    "cover_image_url",
    driver === "mysql" ? "TEXT NULL" : "TEXT",
  );
  await ensureColumn(
    "fishing_trips",
    "public_share",
    driver === "mysql" ? "TINYINT(1) NOT NULL DEFAULT 0" : "INTEGER NOT NULL DEFAULT 0",
  );

  const profiles =
    (await db
      .prepare("SELECT email, display_name, first_name, public_slug FROM profiles")
      .all<{
        email: string;
        display_name?: string;
        first_name?: string;
        public_slug?: string | null;
      }>()).results ?? [];
  const seenSlugs = new Set<string>();
  for (const profile of profiles) {
    let current = profile.public_slug?.trim() || "";
    if (!current) {
      const base = slugify(
        profile.display_name || profile.first_name || profile.email.split("@")[0],
      );
      current = await uniqueProfileSlug(base || "pescador", seenSlugs, profile.email);
      await db
        .prepare("UPDATE profiles SET public_slug=?, updated_at=? WHERE email=?")
        .bind(current, now(), profile.email)
        .run();
    }
    seenSlugs.add(current);
  }

  const portColumns: Array<[string, string, string]> = [
    ["state", "TEXT NOT NULL DEFAULT 'Yucatán'", "VARCHAR(255) NOT NULL DEFAULT 'Yucatán'"],
    ["state_code", "TEXT NOT NULL DEFAULT 'YUC'", "VARCHAR(16) NOT NULL DEFAULT 'YUC'"],
    ["country", "TEXT NOT NULL DEFAULT 'México'", "VARCHAR(255) NOT NULL DEFAULT 'México'"],
    ["country_code", "TEXT NOT NULL DEFAULT 'MX'", "VARCHAR(16) NOT NULL DEFAULT 'MX'"],
    ["latitude", "REAL", "DOUBLE NULL"],
    ["longitude", "REAL", "DOUBLE NULL"],
    ["marine_latitude", "REAL", "DOUBLE NULL"],
    ["marine_longitude", "REAL", "DOUBLE NULL"],
    ["timezone", "TEXT NOT NULL DEFAULT 'America/Merida'", "VARCHAR(100) NOT NULL DEFAULT 'America/Merida'"],
    ["is_weather_enabled", "INTEGER NOT NULL DEFAULT 0", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["tide_check_enabled", "INTEGER NOT NULL DEFAULT 0", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["tide_check_station_id", "TEXT", "VARCHAR(128) NULL"],
    ["tide_check_station_name", "TEXT", "VARCHAR(255) NULL"],
    ["tide_check_station_latitude", "REAL", "DOUBLE NULL"],
    ["tide_check_station_longitude", "REAL", "DOUBLE NULL"],
    ["tide_check_station_state", "TEXT", "VARCHAR(255) NULL"],
    ["tide_check_station_country", "TEXT", "VARCHAR(255) NULL"],
    ["station_verified_at", "TEXT", "VARCHAR(64) NULL"],
    ["station_verified_by", "TEXT", "VARCHAR(255) NULL"],
    ["created_at", "TEXT NOT NULL DEFAULT ''", "VARCHAR(64) NOT NULL DEFAULT ''"],
    ["updated_at", "TEXT NOT NULL DEFAULT ''", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ];

  for (const [column, sqliteDefinition, mysqlDefinition] of portColumns)
    await ensureColumn(
      "ports",
      column,
      driver === "mysql" ? mysqlDefinition : sqliteDefinition,
    );

  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM species")
    .first<{ count: number }>();
  if (!Number(row?.count || 0)) {
    const insertSql =
      driver === "mysql"
        ? "INSERT IGNORE INTO species (id, common_name, aliases, slug, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)"
        : "INSERT OR IGNORE INTO species (id, common_name, aliases, slug, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)";
    const inserts = speciesSeed.map((name, i) =>
      db
        .prepare(insertSql)
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
        "UPDATE ports SET name=?, municipality=?, state='Yucatán', state_code='YUC', country='México', country_code='MX', latitude=?, longitude=?, marine_latitude=?, marine_longitude=?, timezone='America/Merida', is_weather_enabled=1, sort_order=?, active=1, updated_at=? WHERE slug=?",
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

  const thresholdSql =
    driver === "mysql"
      ? "INSERT IGNORE INTO fishing_condition_thresholds (id, region, maximum_favorable_wind_kmh, maximum_caution_wind_kmh, maximum_favorable_gust_kmh, maximum_caution_gust_kmh, maximum_favorable_wave_meters, maximum_caution_wave_meters, minimum_favorable_wave_period_seconds, active, updated_at) VALUES (?, 'Yucatán', 25, 40, 35, 55, 1.2, 2.0, 5, 1, ?)"
      : "INSERT OR IGNORE INTO fishing_condition_thresholds (id, region, maximum_favorable_wind_kmh, maximum_caution_wind_kmh, maximum_favorable_gust_kmh, maximum_caution_gust_kmh, maximum_favorable_wave_meters, maximum_caution_wave_meters, minimum_favorable_wave_period_seconds, active, updated_at) VALUES (?, 'Yucatán', 25, 40, 35, 55, 1.2, 2.0, 5, 1, ?)";
  await db.prepare(thresholdSql).bind(crypto.randomUUID(), timestamp).run();

  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare("DELETE FROM weather_cache WHERE stale_until < ?")
    .bind(staleThreshold)
    .run();
  await db
    .prepare("DELETE FROM weather_rate_limits WHERE updated_at < ?")
    .bind(staleThreshold)
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

async function uniqueProfileSlug(
  base: string,
  reserved: Set<string>,
  email?: string,
) {
  const normalized = slugify(base) || "pescador";
  const db = database();
  let candidate = normalized;
  let suffix = 2;
  while (true) {
    if (!reserved.has(candidate)) {
      const existing = await db
        .prepare(
          "SELECT email FROM profiles WHERE public_slug=? AND (? IS NULL OR email<>?) LIMIT 1",
        )
        .bind(candidate, email ?? null, email ?? null)
        .first<{ email: string }>();
      if (!existing) return candidate;
    }
    candidate = `${normalized}-${suffix++}`;
  }
}

export async function ensureUniquePublicSlug(base: string, email?: string) {
  return uniqueProfileSlug(base, new Set<string>(), email);
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

import mysql from "mysql2/promise";
import type {
  Pool,
  PoolConnection,
  QueryResult,
  ResultSetHeader,
} from "mysql2/promise";

type D1Result<T = unknown> = { results?: T[]; success: boolean };
type Statement = {
  bind: (...values: unknown[]) => Statement;
  run: () => Promise<D1Result>;
  all: <T = unknown>() => Promise<D1Result<T>>;
  first: <T = unknown>() => Promise<T | null>;
};
export type DatabaseClient = {
  prepare: (sql: string) => Statement;
  batch: (items: Statement[]) => Promise<D1Result[]>;
};

type PreparedState = {
  sql: string;
  values: unknown[];
};

type InternalStatement = Statement & {
  __state: PreparedState;
};

const REQUIRED_TABLES = [
  "profiles",
  "fishing_trips",
  "catches",
  "media_assets",
  "species",
  "ports",
  "weather_cache",
  "fishing_trip_weather_snapshots",
  "fishing_condition_thresholds",
  "weather_rate_limits",
  "audit_logs",
  "account_tokens",
] as const;

const REQUIRED_COLUMNS: Record<string, string[]> = {
  profiles: [
    "email",
    "display_name",
    "role",
    "status",
    "password_hash",
    "public_slug",
    "public_profile_enabled",
    "avatar_url",
  ],
  fishing_trips: [
    "id",
    "owner_email",
    "title",
    "port",
    "departure_location_id",
    "cover_image_url",
    "public_share",
  ],
  catches: ["id", "trip_id", "owner_email", "species", "weight_kg"],
  media_assets: ["id", "owner_email", "storage_key", "mime_type", "size_bytes"],
  ports: ["id", "name", "slug", "latitude", "longitude", "marine_latitude", "marine_longitude"],
  species: ["id", "common_name", "slug", "active"],
  weather_cache: ["id", "location_id", "forecast_type", "payload_json"],
  fishing_trip_weather_snapshots: ["id", "fishing_trip_id", "location_id", "provider"],
  fishing_condition_thresholds: ["id", "region", "active", "updated_at"],
  weather_rate_limits: ["id", "rate_key", "window_start", "count"],
  audit_logs: ["id", "actor_email_hash", "action", "entity_type"],
  account_tokens: ["id", "email", "token_hash", "type", "expires_at"],
};

let mysqlPool: Pool | null = null;
let databaseVerified = false;

function readDatabaseUrl() {
  const value = (process.env.DATABASE_URL || "").trim();
  if (!value) {
    throw new Error(
      "DATABASE_URL es obligatoria. Este proyecto usa exclusivamente MySQL y no admite fallbacks locales.",
    );
  }
  if (value.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL no puede apuntar a SQLite o archivos locales. Usa exclusivamente una URL mysql:// hacia yucafish.",
    );
  }
  if (!value.startsWith("mysql://")) {
    throw new Error(
      "DATABASE_URL debe comenzar con mysql://. Este proyecto no soporta SQLite ni otros drivers.",
    );
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "mysql:") {
    throw new Error(
      "DATABASE_URL debe usar el protocolo mysql://. El proyecto no admite sqlite, file: ni otros providers.",
    );
  }
  if (!parsed.hostname || !parsed.username || !parsed.pathname || parsed.pathname === "/") {
    throw new Error(
      "DATABASE_URL está incompleta. Debe incluir usuario, host y nombre de base de datos MySQL.",
    );
  }
  if (process.env.NODE_ENV === "production" && parsed.pathname.slice(1) !== "yucafish") {
    throw new Error(
      "En producción, DATABASE_URL debe apuntar a la base de datos yucafish.",
    );
  }
  return value;
}

function getMysqlPool() {
  if (mysqlPool) return mysqlPool;
  mysqlPool = mysql.createPool({
    uri: readDatabaseUrl(),
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
  return value;
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
      await mysqlRun(state);
      return { success: true };
    },
    async all<T = unknown>() {
      const results = await mysqlAll<T>(state);
      return { success: true, results };
    },
    async first<T = unknown>() {
      const rows = await mysqlAll<T>(state);
      return rows[0] ?? null;
    },
  };
}

export function database(): DatabaseClient {
  return {
    prepare(sql: string) {
      return createStatement({ sql, values: [] });
    },
    async batch(items: Statement[]) {
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
    },
  };
}

export async function ensureDatabase() {
  readDatabaseUrl();
  if (databaseVerified) return;

  const db = database();
  const tables =
    (
      await db
        .prepare(
          `SELECT TABLE_NAME AS tableName
             FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
        )
        .bind(...REQUIRED_TABLES)
        .all<{ tableName: string }>()
    ).results ?? [];

  const foundTables = new Set(tables.map((table) => table.tableName));
  const missingTables = REQUIRED_TABLES.filter((table) => !foundTables.has(table));
  if (missingTables.length) {
    throw new Error(
      `Faltan tablas requeridas en MySQL: ${missingTables.join(", ")}. No se crearán automáticamente; revisa el esquema real de yucafish antes de migrar.`,
    );
  }

  const columns =
    (
      await db
        .prepare(
          `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
             FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
        )
        .bind(...REQUIRED_TABLES)
        .all<{ tableName: string; columnName: string }>()
    ).results ?? [];

  const existingColumns = new Map<string, Set<string>>();
  for (const row of columns) {
    const bucket = existingColumns.get(row.tableName) ?? new Set<string>();
    bucket.add(row.columnName);
    existingColumns.set(row.tableName, bucket);
  }

  const missingColumns: string[] = [];
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    const current = existingColumns.get(tableName) ?? new Set<string>();
    for (const columnName of requiredColumns) {
      if (!current.has(columnName)) missingColumns.push(`${tableName}.${columnName}`);
    }
  }
  if (missingColumns.length) {
    throw new Error(
      `El esquema MySQL no coincide con lo esperado. Faltan columnas: ${missingColumns.join(", ")}. No se alterará automáticamente la base yucafish.`,
    );
  }

  databaseVerified = true;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueProfileSlug(base: string, reserved: Set<string>, email?: string) {
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

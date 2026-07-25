import { NextRequest, NextResponse } from "next/server";
import {
  database,
  ensureDatabase,
  ensureUniquePublicSlug,
  mapRow,
  now,
  slugify,
} from "@/db/runtime";
import { requestIdentity } from "@/lib/server/auth";
import { weatherConfig } from "@/lib/weather/config";
import {
  sendEmailChangeVerificationEmail,
  sendModerationEmail,
} from "@/lib/server/mail";
import { issueAccountToken } from "@/lib/server/account-tokens";
import {
  findNearbyTideStations,
} from "@/lib/weather/service";
import { assertInsideYucatan } from "@/lib/weather/geofence";

export const dynamic = "force-dynamic";

type Payload = Record<string, unknown>;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function audit(
  email: string,
  action: string,
  entityType: string,
  entityId?: string,
) {
  const data = new TextEncoder().encode(email);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
  )
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await database()
    .prepare(
      "INSERT INTO audit_logs (id, actor_email_hash, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      hash,
      action,
      entityType,
      entityId ?? null,
      now(),
    )
    .run();
}

async function ensureProfile(email: string, displayName?: string | null) {
  const db = database();
  const found = await db
    .prepare("SELECT * FROM profiles WHERE email = ?")
    .bind(email)
    .first<Record<string, unknown>>();
  if (found) return mapRow(found);
  const timestamp = now();
  const name =
    displayName ||
    (email.endsWith("@gofishing.local") ? "David Sabido" : email.split("@")[0]);
  const role = email.endsWith("@gofishing.local") ? "ADMIN" : "USER";
  const publicSlug = await ensureUniquePublicSlug(name, email);
  await db
    .prepare(
      "INSERT INTO profiles (email, display_name, first_name, role, public_slug, public_profile_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .bind(
      email,
      name,
      name.split(" ")[0],
      role,
      publicSlug,
      timestamp,
      timestamp,
    )
    .run();
  if (email.endsWith("@gofishing.local")) {
    const daysAgo = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    };
    const samples = [
      {
        id: crypto.randomUUID(),
        title: "Amanecer en Progreso",
        port: "Progreso",
        date: daysAgo(4),
        status: "COMPLETED",
        area: "Bajos del norte",
        vessel: "Mar Azul",
      },
      {
        id: crypto.randomUUID(),
        title: "Salida a Arrecife Alacranes",
        port: "Yucalpetén",
        date: daysAgo(19),
        status: "COMPLETED",
        area: "Arrecife Alacranes",
        vessel: "Aventura",
      },
      {
        id: crypto.randomUUID(),
        title: "Tarde en Chicxulub",
        port: "Chicxulub Puerto",
        date: daysAgo(37),
        status: "DRAFT",
        area: "Costa cercana",
        vessel: "Pescador II",
      },
    ];
    const tripStatements = samples.map((s) =>
      db
        .prepare(
          "INSERT INTO fishing_trips (id, owner_email, title, port, fishing_date, area, vessel, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          s.id,
          email,
          s.title,
          s.port,
          s.date,
          s.area,
          s.vessel,
          s.status,
          "Mar tranquilo y buena compañía.",
          timestamp,
          timestamp,
        ),
    );
    const catchSamples = [
      [samples[0].id, "Mero", 8.4, "KEPT"],
      [samples[0].id, "Jurel", 3.2, "RELEASED"],
      [samples[0].id, "Rubia", 1.8, "KEPT"],
      [samples[1].id, "Dorado", 12.6, "KEPT"],
      [samples[1].id, "Barracuda", 6.1, "RELEASED"],
      [samples[1].id, "Pargo", 2.7, "KEPT"],
      [samples[2].id, "Sierra", 2.1, "UNSPECIFIED"],
    ];
    const catchStatements = catchSamples.map(
      ([tripId, speciesName, weight, release]) =>
        db
          .prepare(
            "INSERT INTO catches (id, trip_id, owner_email, species, custom_species, weight_kg, original_weight, original_unit, release_status, lure, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, 'kg', ?, 'Sardina', ?, ?)",
          )
          .bind(
            crypto.randomUUID(),
            tripId,
            email,
            speciesName,
            weight,
            weight,
            release,
            timestamp,
            timestamp,
          ),
    );
    await db.batch([...tripStatements, ...catchStatements]);
    await db
      .prepare(
        "UPDATE fishing_trips SET departure_location_id=(SELECT id FROM ports WHERE ports.name=fishing_trips.port LIMIT 1) WHERE owner_email=? AND departure_location_id IS NULL",
      )
      .bind(email)
      .run();
  }
  return mapRow(
    (await db
      .prepare("SELECT * FROM profiles WHERE email = ?")
      .bind(email)
      .first<Record<string, unknown>>())!,
  );
}

async function bootstrap(email: string, request: NextRequest) {
  const db = database();
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const profile = await ensureProfile(
    email,
    encodedName ? decodeURIComponent(encodedName) : null,
  );
  const trips =
    (
      await db
        .prepare(
          "SELECT * FROM fishing_trips WHERE owner_email = ? AND deleted_at IS NULL ORDER BY fishing_date DESC, created_at DESC",
        )
        .bind(email)
        .all<Record<string, unknown>>()
    ).results ?? [];
  const catches =
    (
      await db
        .prepare(
          "SELECT * FROM catches WHERE owner_email = ? AND deleted_at IS NULL ORDER BY created_at DESC",
        )
        .bind(email)
        .all<Record<string, unknown>>()
    ).results ?? [];
  const media =
    (
      await db
        .prepare(
          "SELECT id, trip_id, catch_id, alt_text, mime_type FROM media_assets WHERE owner_email = ? AND deleted_at IS NULL",
        )
        .bind(email)
        .all<Record<string, unknown>>()
    ).results ?? [];
  const species =
    (
      await db
        .prepare(
          "SELECT * FROM species ORDER BY active DESC, sort_order, common_name",
        )
        .all<Record<string, unknown>>()
    ).results ?? [];
  const ports =
    (
      await db
        .prepare("SELECT * FROM ports ORDER BY active DESC, sort_order, name")
        .all<Record<string, unknown>>()
    ).results ?? [];
  const logs =
    String(profile.role) === "ADMIN"
      ? ((
          await db
            .prepare(
              "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 25",
            )
            .all<Record<string, unknown>>()
        ).results ?? [])
      : [];
  const snapshots =
    (
      await db
        .prepare(
          "SELECT s.* FROM fishing_trip_weather_snapshots s INNER JOIN fishing_trips t ON t.id=s.fishing_trip_id WHERE t.owner_email=? AND t.deleted_at IS NULL ORDER BY s.captured_at DESC",
        )
        .bind(email)
        .all<Record<string, unknown>>()
    ).results ?? [];
  const weatherSettings =
    String(profile.role) === "ADMIN"
      ? await db
          .prepare(
            "SELECT * FROM fishing_condition_thresholds WHERE active=1 ORDER BY updated_at DESC LIMIT 1",
          )
          .first<Record<string, unknown>>()
      : null;
  const weatherDiagnostics =
    String(profile.role) === "ADMIN"
      ? {
          cacheEntries: Number(
            (
              await db
                .prepare("SELECT COUNT(*) AS count FROM weather_cache")
                .first<{ count: number }>()
            )?.count ?? 0,
          ),
          staleEntries: Number(
            (
              await db
                .prepare(
                  "SELECT COUNT(*) AS count FROM weather_cache WHERE expires_at < ?",
                )
                .bind(now())
                .first<{ count: number }>()
            )?.count ?? 0,
          ),
          lastUpdate:
            (
              await db
                .prepare("SELECT MAX(fetched_at) AS value FROM weather_cache")
                .first<{ value: string | null }>()
            )?.value ?? null,
        }
      : null;
  const adminUsers =
    String(profile.role) === "ADMIN"
      ? ((
          await db
            .prepare(
              "SELECT email, display_name, first_name, last_name, city, state, country, timezone, weight_unit, role, status, public_slug, public_profile_enabled, avatar_url, created_at, updated_at FROM profiles ORDER BY created_at DESC",
            )
            .all<Record<string, unknown>>()
        ).results ?? [])
      : [];
  const adminTrips =
    String(profile.role) === "ADMIN"
      ? ((
          await db
            .prepare(
              "SELECT * FROM fishing_trips WHERE deleted_at IS NULL ORDER BY fishing_date DESC, created_at DESC",
            )
            .all<Record<string, unknown>>()
        ).results ?? [])
      : [];
  const adminCatches =
    String(profile.role) === "ADMIN"
      ? ((
          await db
            .prepare(
              "SELECT * FROM catches WHERE deleted_at IS NULL ORDER BY created_at DESC",
            )
            .all<Record<string, unknown>>()
        ).results ?? [])
      : [];
  const adminMedia =
    String(profile.role) === "ADMIN"
      ? ((
          await db
            .prepare(
              "SELECT id, owner_email, trip_id, catch_id, alt_text, mime_type, deleted_at, created_at FROM media_assets WHERE deleted_at IS NULL ORDER BY created_at DESC",
            )
            .all<Record<string, unknown>>()
        ).results ?? [])
      : [];
  return {
    profile,
    trips: trips.map(mapRow),
    catches: catches.map(mapRow),
    media: media
      .map(mapRow)
      .map((m) => ({ ...m, url: `/api/media?id=${m.id}` })),
    species: species.map(mapRow),
    ports: ports.map(mapRow),
    snapshots: snapshots.map(mapRow),
    weatherSettings: weatherSettings ? mapRow(weatherSettings) : null,
    weatherDiagnostics,
    logs: logs.map(mapRow),
    adminUsers: adminUsers.map(mapRow),
    adminTrips: adminTrips.map(mapRow),
    adminCatches: adminCatches.map(mapRow),
    adminMedia: adminMedia.map(mapRow).map((m) => ({ ...m, url: `/api/media?id=${m.id}` })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const email = requestIdentity(request);
    if (!email) return jsonError("Inicia sesión para continuar.", 401);
    await ensureDatabase();
    return NextResponse.json(await bootstrap(email, request));
  } catch (error) {
    console.error(
      "bootstrap_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return jsonError(
      "No pudimos cargar tu bitácora. Inténtalo nuevamente.",
      500,
    );
  }
}

function text(payload: Payload, key: string, required = false) {
  const value = typeof payload[key] === "string" ? payload[key].trim() : "";
  if (required && !value) throw new Error(`El campo ${key} es obligatorio.`);
  return value || null;
}

function positiveNumber(payload: Payload, key: string) {
  const value = Number(payload[key]);
  if (!Number.isFinite(value) || value <= 0 || value > 1000)
    throw new Error("Ingresa un peso válido mayor que cero.");
  return value;
}

function booleanValue(payload: Payload, key: string, fallback = false) {
  const value = payload[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "si", "sí", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

async function ownedTrip(email: string, id: string) {
  return database()
    .prepare(
      "SELECT id FROM fishing_trips WHERE id = ? AND owner_email = ? AND deleted_at IS NULL",
    )
    .bind(id, email)
    .first<{ id: string }>();
}

export async function POST(request: NextRequest) {
  const email = requestIdentity(request);
  if (!email) return jsonError("Inicia sesión para continuar.", 401);
  try {
    await ensureDatabase();
    const payload = (await request.json()) as Payload;
    const op = text(payload, "op", true)!;
    const db = database();
    const timestamp = now();
    const profile = await ensureProfile(email);

    if (op === "createTrip") {
      const id = crypto.randomUUID();
      const title = text(payload, "title", true)!;
      const port = text(payload, "port", true)!;
      const departureLocationId = text(payload, "departureLocationId");
      if (departureLocationId) {
        const allowedPort = await db
          .prepare("SELECT id, name FROM ports WHERE id=? AND active=1")
          .bind(departureLocationId)
          .first<{ id: string; name: string }>();
        if (!allowedPort || allowedPort.name !== port)
          return jsonError("Selecciona un puerto válido.", 422);
      }
      const fishingDate = text(payload, "fishingDate", true)!;
      await db
        .prepare(
          "INSERT INTO fishing_trips (id, owner_email, title, port, departure_location_id, fishing_date, departure_time, return_time, area, vessel, captain, notes, status, cover_image_url, public_share, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          id,
          email,
          title,
          port,
          departureLocationId,
          fishingDate,
          text(payload, "departureTime"),
          text(payload, "returnTime"),
          text(payload, "area"),
          text(payload, "vessel"),
          text(payload, "captain"),
          text(payload, "notes"),
          payload.status === "COMPLETED" ? "COMPLETED" : "DRAFT",
          text(payload, "coverImageUrl"),
          booleanValue(payload, "publicShare", false) ? 1 : 0,
          timestamp,
          timestamp,
        )
        .run();
      await audit(email, "TRIP_CREATED", "FishingTrip", id);
      return NextResponse.json({
        ok: true,
        id,
        data: await bootstrap(email, request),
      });
    } else if (op === "updateTrip") {
      const id = text(payload, "id", true)!;
      if (!(await ownedTrip(email, id)))
        return jsonError(
          "No tienes permiso para modificar este registro.",
          403,
        );
      const departureLocationId = text(payload, "departureLocationId");
      if (
        departureLocationId &&
        !(await db
          .prepare("SELECT id FROM ports WHERE id=? AND active=1")
          .bind(departureLocationId)
          .first())
      )
        return jsonError("Selecciona un puerto válido.", 422);
      await db
        .prepare(
          "UPDATE fishing_trips SET title=?, port=?, departure_location_id=?, fishing_date=?, departure_time=?, return_time=?, area=?, vessel=?, captain=?, notes=?, status=?, cover_image_url=?, public_share=?, updated_at=? WHERE id=? AND owner_email=?",
        )
        .bind(
          text(payload, "title", true),
          text(payload, "port", true),
          departureLocationId,
          text(payload, "fishingDate", true),
          text(payload, "departureTime"),
          text(payload, "returnTime"),
          text(payload, "area"),
          text(payload, "vessel"),
          text(payload, "captain"),
          text(payload, "notes"),
          payload.status === "COMPLETED" ? "COMPLETED" : "DRAFT",
          text(payload, "coverImageUrl"),
          booleanValue(payload, "publicShare", false) ? 1 : 0,
          timestamp,
          id,
          email,
        )
        .run();
      await audit(email, "TRIP_UPDATED", "FishingTrip", id);
    } else if (op === "setTripCover") {
      const id = text(payload, "id", true)!;
      if (!(await ownedTrip(email, id)))
        return jsonError(
          "No tienes permiso para modificar este registro.",
          403,
        );
      await db
        .prepare(
          "UPDATE fishing_trips SET cover_image_url=?, updated_at=? WHERE id=? AND owner_email=?",
        )
        .bind(text(payload, "coverImageUrl"), timestamp, id, email)
        .run();
      await audit(email, "TRIP_COVER_UPDATED", "FishingTrip", id);
    } else if (op === "toggleTripPublicShare") {
      const id = text(payload, "id", true)!;
      if (!(await ownedTrip(email, id)))
        return jsonError(
          "No tienes permiso para modificar este registro.",
          403,
        );
      await db
        .prepare(
          "UPDATE fishing_trips SET public_share = CASE public_share WHEN 1 THEN 0 ELSE 1 END, updated_at=? WHERE id=? AND owner_email=?",
        )
        .bind(timestamp, id, email)
        .run();
      await audit(email, "TRIP_PUBLIC_SHARE_UPDATED", "FishingTrip", id);
    } else if (op === "deleteTrip") {
      const id = text(payload, "id", true)!;
      if (!(await ownedTrip(email, id)))
        return jsonError("No tienes permiso para eliminar este registro.", 403);
      await db.batch([
        db
          .prepare(
            "UPDATE fishing_trips SET deleted_at=?, updated_at=? WHERE id=? AND owner_email=?",
          )
          .bind(timestamp, timestamp, id, email),
        db
          .prepare(
            "UPDATE catches SET deleted_at=?, updated_at=? WHERE trip_id=? AND owner_email=?",
          )
          .bind(timestamp, timestamp, id, email),
      ]);
      await audit(email, "TRIP_DELETED", "FishingTrip", id);
    } else if (op === "duplicateTrip") {
      const sourceId = text(payload, "id", true)!;
      const source = await db
        .prepare(
          "SELECT * FROM fishing_trips WHERE id=? AND owner_email=? AND deleted_at IS NULL",
        )
        .bind(sourceId, email)
        .first<Record<string, unknown>>();
      if (!source)
        return jsonError(
          "No tienes permiso para consultar este registro.",
          403,
        );
      const id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO fishing_trips (id, owner_email, title, port, departure_location_id, fishing_date, departure_time, return_time, area, vessel, captain, notes, status, cover_image_url, public_share, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, 0, ?, ?)",
        )
        .bind(
          id,
          email,
          `${source.title} (copia)`,
          source.port,
          source.departure_location_id,
          source.fishing_date,
          source.departure_time,
          source.return_time,
          source.area,
          source.vessel,
          source.captain,
          source.notes,
          source.cover_image_url ?? null,
          timestamp,
          timestamp,
        )
        .run();
      await audit(email, "TRIP_DUPLICATED", "FishingTrip", id);
    } else if (op === "createCatch" || op === "updateCatch") {
      const tripId = text(payload, "tripId", true)!;
      if (!(await ownedTrip(email, tripId)))
        return jsonError(
          "No tienes permiso para agregar capturas a esta pesca.",
          403,
        );
      let speciesName = text(payload, "species", true)!;
      const custom = speciesName === "Otro";
      if (custom) speciesName = text(payload, "customSpeciesName", true)!;
      const originalWeight = positiveNumber(payload, "weight");
      const unit = payload.weightUnit === "lb" ? "lb" : "kg";
      const weightKg =
        unit === "lb" ? originalWeight * 0.45359237 : originalWeight;
      const releaseStatus = ["RELEASED", "KEPT"].includes(
        String(payload.releaseStatus),
      )
        ? String(payload.releaseStatus)
        : "UNSPECIFIED";
      if (op === "createCatch") {
        const id = crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO catches (id, trip_id, owner_email, species, custom_species, weight_kg, original_weight, original_unit, release_status, length_cm, caught_at, lure, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            id,
            tripId,
            email,
            speciesName,
            custom ? 1 : 0,
            weightKg,
            originalWeight,
            unit,
            releaseStatus,
            payload.length ? Number(payload.length) : null,
            text(payload, "caughtAt"),
            text(payload, "lure"),
            text(payload, "notes"),
            timestamp,
            timestamp,
          )
          .run();
        await audit(email, "CATCH_CREATED", "Catch", id);
        return NextResponse.json({
          ok: true,
          id,
          data: await bootstrap(email, request),
        });
      }
      const id = text(payload, "id", true)!;
      const found = await db
        .prepare(
          "SELECT id FROM catches WHERE id=? AND trip_id=? AND owner_email=? AND deleted_at IS NULL",
        )
        .bind(id, tripId, email)
        .first();
      if (!found)
        return jsonError("No tienes permiso para modificar esta captura.", 403);
      await db
        .prepare(
          "UPDATE catches SET species=?, custom_species=?, weight_kg=?, original_weight=?, original_unit=?, release_status=?, length_cm=?, caught_at=?, lure=?, notes=?, updated_at=? WHERE id=? AND owner_email=?",
        )
        .bind(
          speciesName,
          custom ? 1 : 0,
          weightKg,
          originalWeight,
          unit,
          releaseStatus,
          payload.length ? Number(payload.length) : null,
          text(payload, "caughtAt"),
          text(payload, "lure"),
          text(payload, "notes"),
          timestamp,
          id,
          email,
        )
        .run();
      await audit(email, "CATCH_UPDATED", "Catch", id);
    } else if (op === "deleteCatch") {
      const id = text(payload, "id", true)!;
      const found = await db
        .prepare(
          "SELECT id FROM catches WHERE id=? AND owner_email=? AND deleted_at IS NULL",
        )
        .bind(id, email)
        .first();
      if (!found)
        return jsonError("No tienes permiso para eliminar esta captura.", 403);
      await db
        .prepare(
          "UPDATE catches SET deleted_at=?, updated_at=? WHERE id=? AND owner_email=?",
        )
        .bind(timestamp, timestamp, id, email)
        .run();
      await audit(email, "CATCH_DELETED", "Catch", id);
    } else if (op === "updateProfile") {
      const displayName = text(payload, "displayName", true)!;
      const uniqueSlug = await ensureUniquePublicSlug(
        String(text(payload, "publicSlug") || "") ||
          String(profile.publicSlug || "") ||
          displayName ||
          String(profile.firstName || "") ||
          email.split("@")[0],
        email,
      );
      await db
        .prepare(
          "UPDATE profiles SET display_name=?, first_name=?, last_name=?, city=?, state=?, country=?, timezone=?, weight_unit=?, public_slug=?, public_profile_enabled=?, avatar_url=?, updated_at=? WHERE email=?",
        )
        .bind(
          displayName,
          text(payload, "firstName") ?? "",
          text(payload, "lastName") ?? "",
          text(payload, "city") ?? "",
          text(payload, "state") ?? "",
          text(payload, "country") ?? "México",
          text(payload, "timezone") ?? "America/Merida",
          payload.weightUnit === "lb" ? "lb" : "kg",
          uniqueSlug,
          booleanValue(payload, "publicProfileEnabled", true) ? 1 : 0,
          text(payload, "avatarUrl"),
          timestamp,
          email,
        )
        .run();
      await audit(email, "PROFILE_UPDATED", "UserProfile");
      const nextEmail = String(text(payload, "newEmail") || "")
        .trim()
        .toLowerCase();
      if (nextEmail && nextEmail !== email) {
        const collision = await db
          .prepare("SELECT email FROM profiles WHERE email=? LIMIT 1")
          .bind(nextEmail)
          .first<{ email: string }>();
        if (collision)
          return jsonError("Ese correo ya está siendo usado por otra cuenta.", 409);
        const token = await issueAccountToken({
          email,
          type: "EMAIL_CHANGE",
          pendingEmail: nextEmail,
          expiresInHours: 24,
        });
        const baseUrl =
          process.env.GOFISHING_APP_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://www.gofishing.mx";
        void sendEmailChangeVerificationEmail({
          currentEmail: email,
          newEmail: nextEmail,
          verifyUrl: `${baseUrl}/verificar-correo?token=${encodeURIComponent(token)}`,
        }).catch((error) => console.error("email-change-email-error", error));
      }
    } else if (op === "adminSetUserStatus") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const targetEmail = text(payload, "email", true)!;
      const status = text(payload, "status", true)! === "ACTIVE" ? "ACTIVE" : "DISABLED";
      const reason = text(payload, "reason") || "Se aplicó una moderación en tu cuenta.";
      await db
        .prepare("UPDATE profiles SET status=?, updated_at=? WHERE email=?")
        .bind(status, timestamp, targetEmail)
        .run();
      void sendModerationEmail({
        email: targetEmail,
        title:
          status === "DISABLED"
            ? "Tu cuenta fue deshabilitada temporalmente"
            : "Tu cuenta fue reactivada",
        reason,
        actionLabel: status === "DISABLED" ? "Cuenta deshabilitada" : "Cuenta reactivada",
      }).catch((error) => console.error("moderation-email-error", error));
      await audit(email, "USER_STATUS_UPDATED", "UserProfile", targetEmail);
    } else if (op === "adminDeleteTrip") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const id = text(payload, "id", true)!;
      const reason = text(payload, "reason") || "Tu pesca fue retirada por moderación.";
      const tripOwner = await db
        .prepare("SELECT owner_email FROM fishing_trips WHERE id=? LIMIT 1")
        .bind(id)
        .first<{ owner_email: string }>();
      await db.batch([
        db
          .prepare("UPDATE fishing_trips SET deleted_at=?, updated_at=? WHERE id=?")
          .bind(timestamp, timestamp, id),
        db
          .prepare("UPDATE catches SET deleted_at=?, updated_at=? WHERE trip_id=?")
          .bind(timestamp, timestamp, id),
      ]);
      if (tripOwner?.owner_email)
        void sendModerationEmail({
          email: tripOwner.owner_email,
          title: "Una pesca de tu cuenta fue retirada",
          reason,
          actionLabel: "Pesca eliminada",
        }).catch((error) => console.error("moderation-email-error", error));
      await audit(email, "ADMIN_TRIP_DELETED", "FishingTrip", id);
    } else if (op === "adminDeleteCatch") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const id = text(payload, "id", true)!;
      await db
        .prepare("UPDATE catches SET deleted_at=?, updated_at=? WHERE id=?")
        .bind(timestamp, timestamp, id)
        .run();
      await audit(email, "ADMIN_CATCH_DELETED", "Catch", id);
    } else if (op === "adminDeleteMedia") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const id = text(payload, "id", true)!;
      await db
        .prepare("UPDATE media_assets SET deleted_at=? WHERE id=?")
        .bind(timestamp, id)
        .run();
      await audit(email, "ADMIN_MEDIA_DELETED", "MediaAsset", id);
    } else if (op === "createSpecies" || op === "createPort") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const name = text(payload, "name", true)!;
      if (op === "createSpecies")
        await db
          .prepare(
            "INSERT INTO species (id, common_name, aliases, slug, sort_order, active) VALUES (?, ?, ?, ?, 999, 1)",
          )
          .bind(
            crypto.randomUUID(),
            name,
            text(payload, "aliases") ?? "",
            `${slugify(name)}-${Date.now().toString(36)}`,
          )
          .run();
      else
        await db
          .prepare(
            "INSERT INTO ports (id, name, slug, type, municipality, sort_order, active) VALUES (?, ?, ?, ?, ?, 999, 1)",
          )
          .bind(
            crypto.randomUUID(),
            name,
            `${slugify(name)}-${Date.now().toString(36)}`,
            payload.type === "MARINA" ? "MARINA" : "PUERTO",
            text(payload, "municipality"),
          )
          .run();
      await audit(
        email,
        op === "createSpecies" ? "SPECIES_CREATED" : "PORT_CREATED",
        op === "createSpecies" ? "FishSpecies" : "DepartureLocation",
      );
    } else if (op === "toggleSpecies" || op === "togglePort") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const id = text(payload, "id", true)!;
      const table = op === "toggleSpecies" ? "species" : "ports";
      await db
        .prepare(
          `UPDATE ${table} SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?`,
        )
        .bind(id)
        .run();
      await audit(email, "CATALOG_STATUS_CHANGED", table, id);
    } else if (op === "updatePortWeather") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const id = text(payload, "id", true)!;
      const number = (
        key: string,
        min: number,
        max: number,
        nullable = false,
      ) => {
        if (
          nullable &&
          (payload[key] === "" ||
            payload[key] === null ||
            payload[key] === undefined)
        )
          return null;
        const parsed = Number(payload[key]);
        if (!Number.isFinite(parsed) || parsed < min || parsed > max)
          throw new Error(`El campo ${key} no es válido.`);
        return parsed;
      };
      const latitude = number("latitude", -90, 90) as number;
      const longitude = number("longitude", -180, 180) as number;
      const marineLatitude = number("marineLatitude", -90, 90, true);
      const marineLongitude = number("marineLongitude", -180, 180, true);
      const timezone = text(payload, "timezone", true)!;
      if (weatherConfig.yucatanGeofenceEnabled) {
        assertInsideYucatan(latitude, longitude, {
          label: "La coordenada terrestre",
        });
        if (marineLatitude !== null && marineLongitude !== null)
          assertInsideYucatan(marineLatitude, marineLongitude, {
            label: "La coordenada marina",
            allowMarineMarginKm: weatherConfig.yucatanMarineMarginKm,
          });
      }
      try {
        new Intl.DateTimeFormat("es-MX", { timeZone: timezone }).format();
      } catch {
        return jsonError("La zona horaria no es válida.", 422);
      }
      await db
        .prepare(
          "UPDATE ports SET state='Yucatán', state_code='YUC', country='México', country_code='MX', latitude=?, longitude=?, marine_latitude=?, marine_longitude=?, timezone=?, is_weather_enabled=?, updated_at=? WHERE id=?",
        )
        .bind(
          latitude,
          longitude,
          marineLatitude,
          marineLongitude,
          timezone,
          payload.isWeatherEnabled ? 1 : 0,
          timestamp,
          id,
        )
        .run();
      await db
        .prepare("DELETE FROM weather_cache WHERE location_id=?")
        .bind(id)
        .run();
      await audit(email, "PORT_WEATHER_UPDATED", "DepartureLocation", id);
    } else if (op === "assignTideStation") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const id = text(payload, "id", true)!;
      const stationId = text(payload, "stationId", true)!;
      const nearby = await findNearbyTideStations(id);
      const selected = nearby.find((station) => station.id === stationId);
      if (!selected)
        return jsonError(
          "La estación no está disponible para este puerto de Yucatán.",
          422,
        );
      await db
        .prepare(
          "UPDATE ports SET tide_check_enabled=1, tide_check_station_id=?, tide_check_station_name=?, tide_check_station_latitude=?, tide_check_station_longitude=?, tide_check_station_state=?, tide_check_station_country=?, station_verified_at=?, station_verified_by=?, updated_at=? WHERE id=?",
        )
        .bind(
          selected.id,
          selected.name,
          selected.latitude,
          selected.longitude,
          selected.region,
          selected.country,
          timestamp,
          email,
          timestamp,
          id,
        )
        .run();
      await db
        .prepare(
          "DELETE FROM weather_cache WHERE location_id=? AND provider='tidecheck'",
        )
        .bind(id)
        .run();
      await audit(email, "TIDECHECK_STATION_ASSIGNED", "DepartureLocation", id);
    } else if (op === "clearTideStation") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const id = text(payload, "id", true)!;
      await db
        .prepare(
          "UPDATE ports SET tide_check_enabled=0, tide_check_station_id=NULL, tide_check_station_name=NULL, tide_check_station_latitude=NULL, tide_check_station_longitude=NULL, tide_check_station_state=NULL, tide_check_station_country=NULL, station_verified_at=NULL, station_verified_by=NULL, updated_at=? WHERE id=?",
        )
        .bind(timestamp, id)
        .run();
      await db
        .prepare(
          "DELETE FROM weather_cache WHERE location_id=? AND provider='tidecheck'",
        )
        .bind(id)
        .run();
      await audit(email, "TIDECHECK_STATION_CLEARED", "DepartureLocation", id);
    } else if (op === "updateWeatherThresholds") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const values = [
        "maximumFavorableWindKmh",
        "maximumCautionWindKmh",
        "maximumFavorableGustKmh",
        "maximumCautionGustKmh",
        "maximumFavorableWaveMeters",
        "maximumCautionWaveMeters",
        "minimumFavorableWavePeriodSeconds",
      ].map((key) => Number(payload[key]));
      if (values.some((value) => !Number.isFinite(value) || value <= 0))
        return jsonError(
          "Todos los umbrales deben ser números positivos.",
          422,
        );
      if (
        values[0] >= values[1] ||
        values[2] >= values[3] ||
        values[4] >= values[5]
      )
        return jsonError(
          "Los límites favorables deben ser menores que los de precaución.",
          422,
        );
      await db
        .prepare(
          "UPDATE fishing_condition_thresholds SET maximum_favorable_wind_kmh=?, maximum_caution_wind_kmh=?, maximum_favorable_gust_kmh=?, maximum_caution_gust_kmh=?, maximum_favorable_wave_meters=?, maximum_caution_wave_meters=?, minimum_favorable_wave_period_seconds=?, updated_at=?, updated_by=? WHERE region='Yucatán'",
        )
        .bind(...values, timestamp, email)
        .run();
      await audit(
        email,
        "WEATHER_THRESHOLDS_UPDATED",
        "FishingConditionThreshold",
        "Yucatán",
      );
    } else if (op === "clearWeatherCache") {
      if (profile.role !== "ADMIN")
        return jsonError("Se requiere acceso de administrador.", 403);
      const locationId = text(payload, "locationId");
      if (locationId)
        await db
          .prepare("DELETE FROM weather_cache WHERE location_id=?")
          .bind(locationId)
          .run();
      else await db.prepare("DELETE FROM weather_cache").run();
      await audit(
        email,
        "WEATHER_CACHE_CLEARED",
        "WeatherCache",
        locationId ?? undefined,
      );
    } else {
      return jsonError("Operación no reconocida.");
    }
    return NextResponse.json({
      ok: true,
      data: await bootstrap(email, request),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No pudimos guardar los cambios.";
    console.error("mutation_failed", message);
    return jsonError(
      message,
      message.includes("obligatorio") || message.includes("válido") ? 422 : 500,
    );
  }
}

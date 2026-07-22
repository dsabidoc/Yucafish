import { NextRequest, NextResponse } from "next/server";
import { database, ensureDatabase, mapRow, now, slugify } from "@/db/runtime";

export const dynamic = "force-dynamic";

type Payload = Record<string, unknown>;

function identity(request: NextRequest) {
  const header = request.headers.get("oai-authenticated-user-email");
  const local = request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";
  return header?.trim().toLowerCase() || (local ? "capitan@yucafish.local" : null);
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function audit(email: string, action: string, entityType: string, entityId?: string) {
  const data = new TextEncoder().encode(email);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data))).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  await database().prepare("INSERT INTO audit_logs (id, actor_email_hash, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), hash, action, entityType, entityId ?? null, now()).run();
}

async function ensureProfile(email: string, displayName?: string | null) {
  const db = database();
  const found = await db.prepare("SELECT * FROM profiles WHERE email = ?").bind(email).first<Record<string, unknown>>();
  if (found) return mapRow(found);
  const timestamp = now();
  const name = displayName || (email.endsWith("@yucafish.local") ? "David Sabido" : email.split("@")[0]);
  const role = email.endsWith("@yucafish.local") ? "ADMIN" : "USER";
  await db.prepare("INSERT INTO profiles (email, display_name, first_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(email, name, name.split(" ")[0], role, timestamp, timestamp).run();
  if (email.endsWith("@yucafish.local")) {
    const daysAgo = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
    const samples = [
      { id: crypto.randomUUID(), title: "Amanecer en Progreso", port: "Progreso", date: daysAgo(4), status: "COMPLETED", area: "Bajos del norte", vessel: "Mar Azul" },
      { id: crypto.randomUUID(), title: "Salida a Arrecife Alacranes", port: "Yucalpetén", date: daysAgo(19), status: "COMPLETED", area: "Arrecife Alacranes", vessel: "Aventura" },
      { id: crypto.randomUUID(), title: "Tarde en Chicxulub", port: "Chicxulub Puerto", date: daysAgo(37), status: "DRAFT", area: "Costa cercana", vessel: "Pescador II" },
    ];
    const tripStatements = samples.map((s) => db.prepare("INSERT INTO fishing_trips (id, owner_email, title, port, fishing_date, area, vessel, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(s.id, email, s.title, s.port, s.date, s.area, s.vessel, s.status, "Mar tranquilo y buena compañía.", timestamp, timestamp));
    const catchSamples = [
      [samples[0].id, "Mero", 8.4, "KEPT"], [samples[0].id, "Jurel", 3.2, "RELEASED"], [samples[0].id, "Rubia", 1.8, "KEPT"],
      [samples[1].id, "Dorado", 12.6, "KEPT"], [samples[1].id, "Barracuda", 6.1, "RELEASED"], [samples[1].id, "Pargo", 2.7, "KEPT"],
      [samples[2].id, "Sierra", 2.1, "UNSPECIFIED"],
    ];
    const catchStatements = catchSamples.map(([tripId, speciesName, weight, release]) => db.prepare("INSERT INTO catches (id, trip_id, owner_email, species, custom_species, weight_kg, original_weight, original_unit, release_status, lure, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, 'kg', ?, 'Sardina', ?, ?)").bind(crypto.randomUUID(), tripId, email, speciesName, weight, weight, release, timestamp, timestamp));
    await db.batch([...tripStatements, ...catchStatements]);
  }
  return mapRow((await db.prepare("SELECT * FROM profiles WHERE email = ?").bind(email).first<Record<string, unknown>>())!);
}

async function bootstrap(email: string, request: NextRequest) {
  const db = database();
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const profile = await ensureProfile(email, encodedName ? decodeURIComponent(encodedName) : null);
  const trips = (await db.prepare("SELECT * FROM fishing_trips WHERE owner_email = ? AND deleted_at IS NULL ORDER BY fishing_date DESC, created_at DESC").bind(email).all<Record<string, unknown>>()).results ?? [];
  const catches = (await db.prepare("SELECT * FROM catches WHERE owner_email = ? AND deleted_at IS NULL ORDER BY created_at DESC").bind(email).all<Record<string, unknown>>()).results ?? [];
  const media = (await db.prepare("SELECT id, trip_id, catch_id, alt_text, mime_type FROM media_assets WHERE owner_email = ? AND deleted_at IS NULL").bind(email).all<Record<string, unknown>>()).results ?? [];
  const species = (await db.prepare("SELECT * FROM species ORDER BY active DESC, sort_order, common_name").all<Record<string, unknown>>()).results ?? [];
  const ports = (await db.prepare("SELECT * FROM ports ORDER BY active DESC, sort_order, name").all<Record<string, unknown>>()).results ?? [];
  const logs = String(profile.role) === "ADMIN" ? ((await db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 25").all<Record<string, unknown>>()).results ?? []) : [];
  return { profile, trips: trips.map(mapRow), catches: catches.map(mapRow), media: media.map(mapRow).map((m) => ({ ...m, url: `/api/media?id=${m.id}` })), species: species.map(mapRow), ports: ports.map(mapRow), logs: logs.map(mapRow) };
}

export async function GET(request: NextRequest) {
  try {
    const email = identity(request);
    if (!email) return jsonError("Inicia sesión para continuar.", 401);
    await ensureDatabase();
    return NextResponse.json(await bootstrap(email, request));
  } catch (error) {
    console.error("bootstrap_failed", error instanceof Error ? error.message : "unknown");
    return jsonError("No pudimos cargar tu bitácora. Inténtalo nuevamente.", 500);
  }
}

function text(payload: Payload, key: string, required = false) {
  const value = typeof payload[key] === "string" ? payload[key].trim() : "";
  if (required && !value) throw new Error(`El campo ${key} es obligatorio.`);
  return value || null;
}

function positiveNumber(payload: Payload, key: string) {
  const value = Number(payload[key]);
  if (!Number.isFinite(value) || value <= 0 || value > 1000) throw new Error("Ingresa un peso válido mayor que cero.");
  return value;
}

async function ownedTrip(email: string, id: string) {
  return database().prepare("SELECT id FROM fishing_trips WHERE id = ? AND owner_email = ? AND deleted_at IS NULL").bind(id, email).first<{ id: string }>();
}

export async function POST(request: NextRequest) {
  const email = identity(request);
  if (!email) return jsonError("Inicia sesión para continuar.", 401);
  try {
    await ensureDatabase();
    const payload = await request.json() as Payload;
    const op = text(payload, "op", true)!;
    const db = database();
    const timestamp = now();
    const profile = await ensureProfile(email);

    if (op === "createTrip") {
      const id = crypto.randomUUID();
      const title = text(payload, "title", true)!;
      const port = text(payload, "port", true)!;
      const fishingDate = text(payload, "fishingDate", true)!;
      await db.prepare("INSERT INTO fishing_trips (id, owner_email, title, port, fishing_date, departure_time, return_time, area, vessel, captain, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, email, title, port, fishingDate, text(payload, "departureTime"), text(payload, "returnTime"), text(payload, "area"), text(payload, "vessel"), text(payload, "captain"), text(payload, "notes"), payload.status === "COMPLETED" ? "COMPLETED" : "DRAFT", timestamp, timestamp).run();
      await audit(email, "TRIP_CREATED", "FishingTrip", id);
      return NextResponse.json({ ok: true, id, data: await bootstrap(email, request) });
    } else if (op === "updateTrip") {
      const id = text(payload, "id", true)!;
      if (!await ownedTrip(email, id)) return jsonError("No tienes permiso para modificar este registro.", 403);
      await db.prepare("UPDATE fishing_trips SET title=?, port=?, fishing_date=?, departure_time=?, return_time=?, area=?, vessel=?, captain=?, notes=?, status=?, updated_at=? WHERE id=? AND owner_email=?").bind(text(payload, "title", true), text(payload, "port", true), text(payload, "fishingDate", true), text(payload, "departureTime"), text(payload, "returnTime"), text(payload, "area"), text(payload, "vessel"), text(payload, "captain"), text(payload, "notes"), payload.status === "COMPLETED" ? "COMPLETED" : "DRAFT", timestamp, id, email).run();
      await audit(email, "TRIP_UPDATED", "FishingTrip", id);
    } else if (op === "deleteTrip") {
      const id = text(payload, "id", true)!;
      if (!await ownedTrip(email, id)) return jsonError("No tienes permiso para eliminar este registro.", 403);
      await db.batch([
        db.prepare("UPDATE fishing_trips SET deleted_at=?, updated_at=? WHERE id=? AND owner_email=?").bind(timestamp, timestamp, id, email),
        db.prepare("UPDATE catches SET deleted_at=?, updated_at=? WHERE trip_id=? AND owner_email=?").bind(timestamp, timestamp, id, email),
      ]);
      await audit(email, "TRIP_DELETED", "FishingTrip", id);
    } else if (op === "duplicateTrip") {
      const sourceId = text(payload, "id", true)!;
      const source = await db.prepare("SELECT * FROM fishing_trips WHERE id=? AND owner_email=? AND deleted_at IS NULL").bind(sourceId, email).first<Record<string, unknown>>();
      if (!source) return jsonError("No tienes permiso para consultar este registro.", 403);
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO fishing_trips (id, owner_email, title, port, fishing_date, departure_time, return_time, area, vessel, captain, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)").bind(id, email, `${source.title} (copia)`, source.port, source.fishing_date, source.departure_time, source.return_time, source.area, source.vessel, source.captain, source.notes, timestamp, timestamp).run();
      await audit(email, "TRIP_DUPLICATED", "FishingTrip", id);
    } else if (op === "createCatch" || op === "updateCatch") {
      const tripId = text(payload, "tripId", true)!;
      if (!await ownedTrip(email, tripId)) return jsonError("No tienes permiso para agregar capturas a esta pesca.", 403);
      let speciesName = text(payload, "species", true)!;
      const custom = speciesName === "Otro";
      if (custom) speciesName = text(payload, "customSpeciesName", true)!;
      const originalWeight = positiveNumber(payload, "weight");
      const unit = payload.weightUnit === "lb" ? "lb" : "kg";
      const weightKg = unit === "lb" ? originalWeight * 0.45359237 : originalWeight;
      const releaseStatus = ["RELEASED", "KEPT"].includes(String(payload.releaseStatus)) ? String(payload.releaseStatus) : "UNSPECIFIED";
      if (op === "createCatch") {
        const id = crypto.randomUUID();
        await db.prepare("INSERT INTO catches (id, trip_id, owner_email, species, custom_species, weight_kg, original_weight, original_unit, release_status, length_cm, caught_at, lure, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, tripId, email, speciesName, custom ? 1 : 0, weightKg, originalWeight, unit, releaseStatus, payload.length ? Number(payload.length) : null, text(payload, "caughtAt"), text(payload, "lure"), text(payload, "notes"), timestamp, timestamp).run();
        await audit(email, "CATCH_CREATED", "Catch", id);
        return NextResponse.json({ ok: true, id, data: await bootstrap(email, request) });
      }
      const id = text(payload, "id", true)!;
      const found = await db.prepare("SELECT id FROM catches WHERE id=? AND trip_id=? AND owner_email=? AND deleted_at IS NULL").bind(id, tripId, email).first();
      if (!found) return jsonError("No tienes permiso para modificar esta captura.", 403);
      await db.prepare("UPDATE catches SET species=?, custom_species=?, weight_kg=?, original_weight=?, original_unit=?, release_status=?, length_cm=?, caught_at=?, lure=?, notes=?, updated_at=? WHERE id=? AND owner_email=?").bind(speciesName, custom ? 1 : 0, weightKg, originalWeight, unit, releaseStatus, payload.length ? Number(payload.length) : null, text(payload, "caughtAt"), text(payload, "lure"), text(payload, "notes"), timestamp, id, email).run();
      await audit(email, "CATCH_UPDATED", "Catch", id);
    } else if (op === "deleteCatch") {
      const id = text(payload, "id", true)!;
      const found = await db.prepare("SELECT id FROM catches WHERE id=? AND owner_email=? AND deleted_at IS NULL").bind(id, email).first();
      if (!found) return jsonError("No tienes permiso para eliminar esta captura.", 403);
      await db.prepare("UPDATE catches SET deleted_at=?, updated_at=? WHERE id=? AND owner_email=?").bind(timestamp, timestamp, id, email).run();
      await audit(email, "CATCH_DELETED", "Catch", id);
    } else if (op === "updateProfile") {
      await db.prepare("UPDATE profiles SET display_name=?, first_name=?, last_name=?, city=?, state=?, country=?, timezone=?, weight_unit=?, updated_at=? WHERE email=?").bind(text(payload, "displayName", true), text(payload, "firstName") ?? "", text(payload, "lastName") ?? "", text(payload, "city") ?? "", text(payload, "state") ?? "", text(payload, "country") ?? "México", text(payload, "timezone") ?? "America/Merida", payload.weightUnit === "lb" ? "lb" : "kg", timestamp, email).run();
      await audit(email, "PROFILE_UPDATED", "UserProfile");
    } else if (op === "createSpecies" || op === "createPort") {
      if (profile.role !== "ADMIN") return jsonError("Se requiere acceso de administrador.", 403);
      const name = text(payload, "name", true)!;
      if (op === "createSpecies") await db.prepare("INSERT INTO species (id, common_name, aliases, slug, sort_order, active) VALUES (?, ?, ?, ?, 999, 1)").bind(crypto.randomUUID(), name, text(payload, "aliases") ?? "", `${slugify(name)}-${Date.now().toString(36)}`).run();
      else await db.prepare("INSERT INTO ports (id, name, slug, type, municipality, sort_order, active) VALUES (?, ?, ?, ?, ?, 999, 1)").bind(crypto.randomUUID(), name, `${slugify(name)}-${Date.now().toString(36)}`, payload.type === "MARINA" ? "MARINA" : "PUERTO", text(payload, "municipality")).run();
      await audit(email, op === "createSpecies" ? "SPECIES_CREATED" : "PORT_CREATED", op === "createSpecies" ? "FishSpecies" : "DepartureLocation");
    } else if (op === "toggleSpecies" || op === "togglePort") {
      if (profile.role !== "ADMIN") return jsonError("Se requiere acceso de administrador.", 403);
      const id = text(payload, "id", true)!;
      const table = op === "toggleSpecies" ? "species" : "ports";
      await db.prepare(`UPDATE ${table} SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?`).bind(id).run();
      await audit(email, "CATALOG_STATUS_CHANGED", table, id);
    } else {
      return jsonError("Operación no reconocida.");
    }
    return NextResponse.json({ ok: true, data: await bootstrap(email, request) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar los cambios.";
    console.error("mutation_failed", message);
    return jsonError(message, message.includes("obligatorio") || message.includes("válido") ? 422 : 500);
  }
}

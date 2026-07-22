import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { database, ensureDatabase, now } from "@/db/runtime";

export const dynamic = "force-dynamic";
type Bucket = {
  put: (key: string, value: ArrayBuffer, options?: unknown) => Promise<void>;
  get: (
    key: string,
  ) => Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
  } | null>;
  delete: (key: string) => Promise<void>;
};
const bucket = () => (env as unknown as { BUCKET: Bucket }).BUCKET;
const user = (request: NextRequest) =>
  request.headers.get("oai-authenticated-user-email")?.toLowerCase() ||
  (request.nextUrl.hostname === "localhost" ||
  request.nextUrl.hostname === "127.0.0.1"
    ? "capitan@yucafish.local"
    : null);

function validMagic(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  if (type === "image/webp")
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}

export async function POST(request: NextRequest) {
  const email = user(request);
  if (!email)
    return NextResponse.json(
      { error: "Inicia sesión para continuar." },
      { status: 401 },
    );
  await ensureDatabase();
  const data = await request.formData();
  const file = data.get("file");
  const tripId = String(data.get("tripId") || "");
  const catchId = String(data.get("catchId") || "");
  if (!(file instanceof File) || !tripId || !catchId)
    return NextResponse.json(
      { error: "Selecciona una fotografía válida." },
      { status: 422 },
    );
  if (file.size > 8 * 1024 * 1024)
    return NextResponse.json(
      { error: "La fotografía supera el límite de 8 MB." },
      { status: 413 },
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validMagic(bytes, file.type))
    return NextResponse.json(
      { error: "Solo se permiten imágenes JPG, PNG o WebP válidas." },
      { status: 415 },
    );
  const db = database();
  const owned = await db
    .prepare(
      "SELECT c.id FROM catches c JOIN fishing_trips t ON t.id=c.trip_id WHERE c.id=? AND c.trip_id=? AND c.owner_email=? AND t.owner_email=? AND c.deleted_at IS NULL AND t.deleted_at IS NULL",
    )
    .bind(catchId, tripId, email, email)
    .first();
  if (!owned)
    return NextResponse.json(
      { error: "No tienes permiso para agregar imágenes a esta captura." },
      { status: 403 },
    );
  const id = crypto.randomUUID();
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const key = `users/${await safeHash(email)}/trips/${tripId}/${id}.${ext}`;
  await bucket().put(key, bytes.buffer, {
    httpMetadata: { contentType: file.type },
  });
  await db
    .prepare(
      "INSERT INTO media_assets (id, owner_email, trip_id, catch_id, storage_key, mime_type, size_bytes, alt_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      email,
      tripId,
      catchId,
      key,
      file.type,
      file.size,
      `Captura de pesca: ${file.name.replace(/\.[^.]+$/, "")}`,
      now(),
    )
    .run();
  return NextResponse.json({ ok: true, id, url: `/api/media?id=${id}` });
}

export async function GET(request: NextRequest) {
  const email = user(request);
  if (!email) return new NextResponse("Unauthorized", { status: 401 });
  await ensureDatabase();
  const id = request.nextUrl.searchParams.get("id");
  const asset = await database()
    .prepare(
      "SELECT storage_key, mime_type FROM media_assets WHERE id=? AND owner_email=? AND deleted_at IS NULL",
    )
    .bind(id, email)
    .first<{ storage_key: string; mime_type: string }>();
  if (!asset) return new NextResponse("Not found", { status: 404 });
  const object = await bucket().get(asset.storage_key);
  if (!object) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(object.body, {
    headers: {
      "content-type": asset.mime_type,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(request: NextRequest) {
  const email = user(request);
  if (!email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDatabase();
  const id = request.nextUrl.searchParams.get("id");
  const db = database();
  const asset = await db
    .prepare(
      "SELECT storage_key FROM media_assets WHERE id=? AND owner_email=? AND deleted_at IS NULL",
    )
    .bind(id, email)
    .first<{ storage_key: string }>();
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await bucket().delete(asset.storage_key);
  await db
    .prepare(
      "UPDATE media_assets SET deleted_at=? WHERE id=? AND owner_email=?",
    )
    .bind(now(), id, email)
    .run();
  return NextResponse.json({ ok: true });
}

async function safeHash(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

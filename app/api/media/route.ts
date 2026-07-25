import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { database, ensureDatabase, now } from "@/db/runtime";
import { requestIdentity } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

function uploadsRoot() {
  return (
    process.env.GOFISHING_UPLOADS_DIR ||
    process.env.UPLOADS_DIR ||
    path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads")
  );
}

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
  const email = requestIdentity(request);
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
  const kind = String(data.get("kind") || "");
  if (!(file instanceof File) || (!tripId && kind !== "avatar"))
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
  const owned =
    kind === "avatar"
      ? { id: email }
      : catchId
        ? await db
            .prepare(
              "SELECT c.id FROM catches c JOIN fishing_trips t ON t.id=c.trip_id WHERE c.id=? AND c.trip_id=? AND c.owner_email=? AND t.owner_email=? AND c.deleted_at IS NULL AND t.deleted_at IS NULL",
            )
            .bind(catchId, tripId, email, email)
            .first()
        : await db
            .prepare(
              "SELECT id FROM fishing_trips WHERE id=? AND owner_email=? AND deleted_at IS NULL",
            )
            .bind(tripId, email)
            .first();
  if (!owned && kind !== "avatar")
    return NextResponse.json(
      {
        error: catchId
          ? "No tienes permiso para agregar imágenes a esta captura."
          : "No tienes permiso para agregar una portada a esta pesca.",
      },
      { status: 403 },
    );
  const id = crypto.randomUUID();
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const key =
    kind === "avatar"
      ? `users/${await safeHash(email)}/avatars/${id}.${ext}`
      : `users/${await safeHash(email)}/trips/${tripId}/${id}.${ext}`;
  const filePath = path.join(uploadsRoot(), key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  await db
    .prepare(
      "INSERT INTO media_assets (id, owner_email, trip_id, catch_id, storage_key, mime_type, size_bytes, alt_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      email,
      tripId || null,
      catchId || null,
      key,
      file.type,
      file.size,
      kind === "avatar"
        ? `Avatar de perfil: ${file.name.replace(/\.[^.]+$/, "")}`
        : catchId
          ? `Captura de pesca: ${file.name.replace(/\.[^.]+$/, "")}`
          : `Portada de pesca: ${file.name.replace(/\.[^.]+$/, "")}`,
      now(),
    )
    .run();
  return NextResponse.json({ ok: true, id, url: `/api/media?id=${id}` });
}

export async function GET(request: NextRequest) {
  const email = requestIdentity(request);
  await ensureDatabase();
  const id = request.nextUrl.searchParams.get("id");
  const asset = await database()
    .prepare(
      "SELECT m.storage_key, m.mime_type, m.owner_email, m.trip_id, p.public_profile_enabled, p.status AS profile_status, t.public_share, t.status AS trip_status, t.deleted_at AS trip_deleted_at FROM media_assets m LEFT JOIN profiles p ON p.email=m.owner_email LEFT JOIN fishing_trips t ON t.id=m.trip_id WHERE m.id=? AND m.deleted_at IS NULL LIMIT 1",
    )
    .bind(id)
    .first<{
      storage_key: string;
      mime_type: string;
      owner_email: string;
      trip_id: string | null;
      public_profile_enabled: number | null;
      profile_status: string | null;
      public_share: number | null;
      trip_status: string | null;
      trip_deleted_at: string | null;
    }>();
  if (!asset) return new NextResponse("Not found", { status: 404 });
  const isOwner = Boolean(email) && asset.owner_email === email;
  const isPublicTrip =
    Boolean(asset.trip_id) &&
    Number(asset.public_share || 0) === 1 &&
    asset.trip_status === "COMPLETED" &&
    !asset.trip_deleted_at &&
    Number(asset.public_profile_enabled || 0) === 1 &&
    asset.profile_status === "ACTIVE";
  const isPublicAvatar =
    !asset.trip_id &&
    Number(asset.public_profile_enabled || 0) === 1 &&
    asset.profile_status === "ACTIVE";
  if (!isOwner && !isPublicTrip && !isPublicAvatar)
    return new NextResponse("Unauthorized", { status: 401 });
  try {
    const body = await readFile(path.join(uploadsRoot(), asset.storage_key));
    return new NextResponse(body, {
      headers: {
        "content-type": asset.mime_type,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export async function DELETE(request: NextRequest) {
  const email = requestIdentity(request);
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
  await rm(path.join(uploadsRoot(), asset.storage_key), { force: true });
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

import { NextRequest, NextResponse } from "next/server";
import { consumeAccountToken } from "@/lib/server/account-tokens";
import { database, ensureDatabase, now } from "@/db/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await ensureDatabase();
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token || "").trim();
  if (!token)
    return NextResponse.json(
      { error: "No pudimos validar este cambio de correo." },
      { status: 422 },
    );
  const consumed = await consumeAccountToken(token, "EMAIL_CHANGE");
  if (!consumed || !consumed.pending_email)
    return NextResponse.json(
      { error: "Este enlace ya no es válido o ya fue utilizado." },
      { status: 410 },
    );
  const db = database();
  const newEmail = String(consumed.pending_email).trim().toLowerCase();
  const currentEmail = String(consumed.email).trim().toLowerCase();
  const collision = await db
    .prepare("SELECT email FROM profiles WHERE email=? LIMIT 1")
    .bind(newEmail)
    .first<{ email: string }>();
  if (collision && collision.email !== currentEmail)
    return NextResponse.json(
      { error: "Ese correo ya está siendo usado por otra cuenta." },
      { status: 409 },
    );
  await db.batch([
    db
      .prepare("UPDATE profiles SET email=?, updated_at=? WHERE email=?")
      .bind(newEmail, now(), currentEmail),
    db
      .prepare("UPDATE fishing_trips SET owner_email=? WHERE owner_email=?")
      .bind(newEmail, currentEmail),
    db
      .prepare("UPDATE catches SET owner_email=? WHERE owner_email=?")
      .bind(newEmail, currentEmail),
    db
      .prepare("UPDATE media_assets SET owner_email=? WHERE owner_email=?")
      .bind(newEmail, currentEmail),
  ]);
  return NextResponse.json({ ok: true, email: newEmail });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, ensureDatabase, now } from "@/db/runtime";
import {
  applySessionCookie,
  clearSessionCookie,
  hashPassword,
  verifyPassword,
} from "@/lib/server/session";
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "@/lib/server/mail";
import {
  consumeAccountToken,
  issueAccountToken,
} from "@/lib/server/account-tokens";

const payloadSchema = z.object({
  action: z.enum(["register", "login", "logout", "forgot", "reset"]),
  name: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).optional(),
  token: z.string().trim().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await ensureDatabase();
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Revisa los datos de acceso." },
      { status: 422 },
    );
  const { action } = parsed.data;

  if (action === "logout") {
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  }

  const db = database();
  const email = parsed.data.email?.trim().toLowerCase();
  const password = parsed.data.password;
  const existing = email
    ? await db
        .prepare("SELECT * FROM profiles WHERE email=?")
        .bind(email)
        .first<Record<string, unknown>>()
    : null;

  if (action === "forgot") {
    if (!email)
      return NextResponse.json(
        { error: "Escribe tu correo electrónico." },
        { status: 422 },
      );
    if (existing?.password_hash) {
      const baseUrl =
        process.env.GOFISHING_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://www.gofishing.mx";
      const token = await issueAccountToken({
        email,
        type: "PASSWORD_RESET",
        expiresInHours: 2,
      });
      void sendPasswordResetEmail({
        email,
        resetUrl: `${baseUrl}/restablecer-contrasena?token=${encodeURIComponent(token)}`,
      }).catch((error) => console.error("password-reset-email-error", error));
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    const token = parsed.data.token?.trim();
    if (!token || !password)
      return NextResponse.json(
        { error: "No pudimos validar el restablecimiento." },
        { status: 422 },
      );
    const consumed = await consumeAccountToken(token, "PASSWORD_RESET");
    if (!consumed)
      return NextResponse.json(
        { error: "El enlace ya no es válido o ya fue utilizado." },
        { status: 410 },
      );
    await db
      .prepare("UPDATE profiles SET password_hash=?, updated_at=? WHERE email=?")
      .bind(hashPassword(password), now(), String(consumed.email))
      .run();
    return NextResponse.json({ ok: true });
  }

  if (!email || !password)
    return NextResponse.json(
      { error: "Revisa los datos de acceso." },
      { status: 422 },
    );

  if (action === "register") {
    const fullName = (parsed.data.name || "").trim();
    if (!fullName)
      return NextResponse.json(
        { error: "Escribe tu nombre completo." },
        { status: 422 },
      );
    if (existing && existing.password_hash)
      return NextResponse.json(
        { error: "Ya existe una cuenta con este correo." },
        { status: 409 },
      );
    const timestamp = now();
    const passwordHash = hashPassword(password);
    const names = fullName.split(/\s+/).filter(Boolean);
    if (existing) {
      await db
        .prepare(
          "UPDATE profiles SET display_name=?, first_name=?, last_name=?, password_hash=?, updated_at=? WHERE email=?",
        )
        .bind(
          fullName,
          names[0] || fullName,
          names.slice(1).join(" "),
          passwordHash,
          timestamp,
          email,
        )
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO profiles (email, display_name, first_name, last_name, city, state, country, timezone, weight_unit, role, status, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, '', 'Yucatán', 'México', 'America/Merida', 'kg', 'USER', 'ACTIVE', ?, ?, ?)",
        )
        .bind(
          email,
          fullName,
          names[0] || fullName,
          names.slice(1).join(" "),
          passwordHash,
          timestamp,
          timestamp,
        )
        .run();
    }
    const response = NextResponse.json({ ok: true });
    applySessionCookie(response, email);
    void sendWelcomeEmail({
      email,
      name: fullName,
    }).catch((error) => {
      console.error("welcome-email-error", error);
    });
    return response;
  }

  if (existing && String(existing.status || "ACTIVE") !== "ACTIVE")
    return NextResponse.json(
      { error: "Tu cuenta está deshabilitada. Revisa tu correo para más información." },
      { status: 403 },
    );

  if (!existing || !verifyPassword(password, String(existing.password_hash || "")))
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos." },
      { status: 401 },
    );

  const response = NextResponse.json({ ok: true });
  applySessionCookie(response, email);
  return response;
}

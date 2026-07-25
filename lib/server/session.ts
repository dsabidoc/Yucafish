import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "gofishing_session";

function sessionSecret() {
  return (
    process.env.GOFISHING_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    "change-this-secret-in-production"
  );
}

function base64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function unbase64url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function createSessionValue(email: string) {
  const payload = base64url(
    JSON.stringify({
      email: email.trim().toLowerCase(),
      issuedAt: Date.now(),
    }),
  );
  return `${payload}.${sign(payload)}`;
}

export function readSessionEmailFromCookie(raw: string | null | undefined) {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  )
    return null;
  try {
    const parsed = JSON.parse(unbase64url(payload)) as { email?: string };
    return parsed.email?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export function readSessionEmail(request: NextRequest) {
  return readSessionEmailFromCookie(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function currentSessionEmail() {
  const store = await cookies();
  return readSessionEmailFromCookie(store.get(SESSION_COOKIE)?.value);
}

export function applySessionCookie(response: NextResponse, email: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionValue(email),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const iterations = 120000;
  const digest = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString(
    "hex",
  );
  return `pbkdf2_sha256$${iterations}$${salt}$${digest}`;
}

export function verifyPassword(password: string, encoded: string | null | undefined) {
  if (!encoded) return false;
  const [scheme, iterationsText, salt, digest] = encoded.split("$");
  if (scheme !== "pbkdf2_sha256" || !iterationsText || !salt || !digest)
    return false;
  const computed = pbkdf2Sync(
    password,
    salt,
    Number(iterationsText),
    32,
    "sha256",
  ).toString("hex");
  return (
    computed.length === digest.length &&
    timingSafeEqual(Buffer.from(computed), Buffer.from(digest))
  );
}

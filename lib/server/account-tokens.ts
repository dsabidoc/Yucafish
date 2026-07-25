import { database, ensureDatabase, now } from "@/db/runtime";

type TokenType = "PASSWORD_RESET" | "EMAIL_CHANGE";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

export async function issueAccountToken(input: {
  email: string;
  type: TokenType;
  pendingEmail?: string | null;
  reason?: string | null;
  expiresInHours?: number;
}) {
  await ensureDatabase();
  const rawToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const tokenHash = await sha256(rawToken);
  const createdAt = now();
  const expiresAt = new Date(
    Date.now() + (input.expiresInHours || 2) * 60 * 60 * 1000,
  ).toISOString();
  await database()
    .prepare(
      "INSERT INTO account_tokens (id, email, token_hash, type, pending_email, reason, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)",
    )
    .bind(
      crypto.randomUUID(),
      input.email,
      tokenHash,
      input.type,
      input.pendingEmail ?? null,
      input.reason ?? null,
      expiresAt,
      createdAt,
    )
    .run();
  return rawToken;
}

export async function consumeAccountToken(token: string, type: TokenType) {
  await ensureDatabase();
  const tokenHash = await sha256(token);
  const row = await database()
    .prepare(
      "SELECT * FROM account_tokens WHERE token_hash=? AND type=? AND used_at IS NULL LIMIT 1",
    )
    .bind(tokenHash, type)
    .first<Record<string, unknown>>();
  if (!row) return null;
  if (String(row.expires_at || row.expiresAt) < now()) return null;
  await database()
    .prepare("UPDATE account_tokens SET used_at=? WHERE id=?")
    .bind(now(), String(row.id))
    .run();
  return row;
}

export async function clearExpiredAccountTokens() {
  await ensureDatabase();
  await database()
    .prepare("DELETE FROM account_tokens WHERE expires_at < ? OR used_at IS NOT NULL")
    .bind(now())
    .run();
}

import { database, ensureDatabase, now } from "../db/runtime";
import { hashPassword } from "../lib/server/session";
import { sendWelcomeEmail } from "../lib/server/mail";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return "";
  return (process.argv[index + 1] || "").trim();
}

async function main() {
  const email = arg("email").toLowerCase();
  const password = arg("password");
  const name = arg("name") || "Administrador GoFishing.mx";
  const sendWelcome = process.argv.includes("--send-welcome");

  if (!email || !password) {
    console.error(
      "Uso: npx tsx scripts/provision-admin.ts --email hi@dominio.com --password TuPassword123! [--name \"Nombre\"] [--send-welcome]",
    );
    process.exit(1);
  }

  await ensureDatabase();
  const db = database();
  const existing = await db
    .prepare("SELECT email FROM profiles WHERE email=?")
    .bind(email)
    .first<{ email: string }>();

  const timestamp = now();
  const parts = name.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || name;
  const lastName = parts.slice(1).join(" ");
  const passwordHash = hashPassword(password);

  if (existing) {
    await db
      .prepare(
        "UPDATE profiles SET display_name=?, first_name=?, last_name=?, role='ADMIN', status='ACTIVE', password_hash=?, updated_at=? WHERE email=?",
      )
      .bind(name, firstName, lastName, passwordHash, timestamp, email)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO profiles (email, display_name, first_name, last_name, city, state, country, timezone, weight_unit, role, status, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, '', 'Yucatán', 'México', 'America/Merida', 'kg', 'ADMIN', 'ACTIVE', ?, ?, ?)",
      )
      .bind(email, name, firstName, lastName, passwordHash, timestamp, timestamp)
      .run();
  }

  if (sendWelcome) {
    await sendWelcomeEmail({ email, name, password });
  }

  console.log(`Administrador listo: ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

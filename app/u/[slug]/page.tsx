import { database, ensureDatabase, mapRow } from "@/db/runtime";
import { CommunityClient } from "@/app/components/CommunityClient";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  noStore();
  await ensureDatabase();
  const { slug } = await params;
  const db = database();
  const profileRow = await db
    .prepare(
      "SELECT * FROM profiles WHERE public_slug=? AND public_profile_enabled=1 LIMIT 1",
    )
    .bind(slug)
    .first<Record<string, unknown>>();

  if (!profileRow) {
    return (
      <main className="legal-page">
        <a href="/">← Volver a GoFishing.mx</a>
        <h1>Perfil no disponible</h1>
        <p>
          Este perfil público no existe o el usuario decidió mantenerlo
          privado.
        </p>
      </main>
    );
  }

  const profile = mapRow(profileRow);
  const trips =
    (await db
      .prepare(
        "SELECT * FROM fishing_trips WHERE owner_email=? AND status='COMPLETED' AND public_share=1 AND deleted_at IS NULL ORDER BY fishing_date DESC, created_at DESC LIMIT 12",
      )
      .bind(String(profile.email))
      .all<Record<string, unknown>>()).results?.map(mapRow) ?? [];
  const catches =
    (await db
      .prepare(
        "SELECT * FROM catches WHERE owner_email=? AND deleted_at IS NULL ORDER BY created_at DESC",
      )
      .bind(String(profile.email))
      .all<Record<string, unknown>>()).results?.map(mapRow) ?? [];

  const totalWeight = catches.reduce(
    (sum, item) => sum + Number(item.weightKg || 0),
    0,
  );
  const topSpecies =
    Object.entries(
      catches.reduce<Record<string, number>>((acc, item) => {
        const key = String(item.species || "Otro");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] || "Sin registros";

  return (
    <CommunityClient
      title={String(profile.displayName || profile.firstName || "Pescador")}
      subtitle="Perfil público de la comunidad con las pescas que este usuario decidió compartir."
      profiles={[
        {
          displayName: String(
            profile.displayName || profile.firstName || "Pescador",
          ),
          publicSlug: String(profile.publicSlug || slug),
          avatarUrl: profile.avatarUrl ? String(profile.avatarUrl) : null,
          catchesCount: catches.length,
          tripsCount: trips.length,
          topSpecies,
          totalWeight,
          profileOnly: true,
        },
      ]}
      trips={trips.map((trip) => ({
        id: String(trip.id),
        ownerEmail: String(trip.ownerEmail || profile.email || ""),
        ownerSlug: String(profile.publicSlug || slug),
        ownerName: String(profile.displayName || profile.firstName || "Pescador"),
        title: String(trip.title || "Salida de pesca"),
        port: String(trip.port || "Puerto"),
        coverImageUrl: trip.coverImageUrl ? String(trip.coverImageUrl) : null,
      }))}
      catches={catches.map((item) => ({
        id: String(item.id),
        tripId: String(item.tripId),
        species: String(item.species || "Captura"),
        weightKg: Number(item.weightKg || 0),
      }))}
      profileMode
    />
  );
}

import { CommunityClient } from "@/app/components/CommunityClient";
import { database, ensureDatabase, mapRow } from "@/db/runtime";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityPage() {
  noStore();
  await ensureDatabase();
  const db = database();
  const profiles =
    (await db
      .prepare(
        "SELECT display_name, public_slug, avatar_url FROM profiles WHERE public_profile_enabled=1 AND status='ACTIVE' ORDER BY updated_at DESC",
      )
      .all<Record<string, unknown>>()).results?.map(mapRow) ?? [];
  const trips =
    (await db
      .prepare(
        "SELECT t.id, t.owner_email, t.title, t.port, t.cover_image_url, p.display_name AS owner_name, p.public_slug AS owner_slug FROM fishing_trips t INNER JOIN profiles p ON p.email=t.owner_email WHERE t.deleted_at IS NULL AND t.status='COMPLETED' AND t.public_share=1 AND p.public_profile_enabled=1 AND p.status='ACTIVE' ORDER BY t.updated_at DESC",
      )
      .all<Record<string, unknown>>()).results?.map(mapRow) ?? [];
  const catches =
    (await db
      .prepare(
        "SELECT c.id, c.trip_id, c.species, c.weight_kg FROM catches c INNER JOIN fishing_trips t ON t.id=c.trip_id INNER JOIN profiles p ON p.email=t.owner_email WHERE c.deleted_at IS NULL AND t.deleted_at IS NULL AND t.status='COMPLETED' AND t.public_share=1 AND p.public_profile_enabled=1 AND p.status='ACTIVE' ORDER BY c.created_at DESC",
      )
      .all<Record<string, unknown>>()).results?.map(mapRow) ?? [];
  return (
    <CommunityClient
      title="Comunidad GoFishing.mx"
      subtitle="Perfiles y pescas públicas compartidas por la comunidad."
      profiles={profiles as never}
      trips={trips as never}
      catches={catches as never}
    />
  );
}

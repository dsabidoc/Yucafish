import { NextRequest, NextResponse } from "next/server";
import { requestIdentity } from "@/lib/server/auth";
import { locationIdSchema } from "@/lib/weather/schemas";
import { checkRateLimit, findNearbyTideStations } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const email = requestIdentity(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { locationId } = await params;
    const parsed = locationIdSchema.safeParse(locationId);
    if (!parsed.success)
      return NextResponse.json({ error: "Puerto inválido." }, { status: 400 });
    await checkRateLimit(`${email}:weather-stations`, 10);
    const data = await findNearbyTideStations(parsed.data);
    return NextResponse.json({ items: data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible consultar estaciones de mareas.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

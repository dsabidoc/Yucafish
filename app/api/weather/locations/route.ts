import { NextRequest, NextResponse } from "next/server";
import { requestIdentity } from "@/lib/server/auth";
import { checkRateLimit, listWeatherLocations } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const email = requestIdentity(request);
  if (!email)
    return NextResponse.json(
      { error: "Inicia sesión para continuar." },
      { status: 401 },
    );
  try {
    await checkRateLimit(`${email}:weather-locations`, 30);
    return NextResponse.json({ locations: await listWeatherLocations() });
  } catch (error) {
    console.error(
      "weather_locations_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "No pudimos cargar los puertos meteorológicos." },
      { status: 500 },
    );
  }
}

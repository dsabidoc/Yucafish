import { NextRequest, NextResponse } from "next/server";
import { requestIdentity } from "@/lib/server/auth";
import { locationIdSchema } from "@/lib/weather/schemas";
import { checkRateLimit, getPortForecast } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> },
) {
  const email = requestIdentity(request);
  if (!email)
    return NextResponse.json(
      { error: "Inicia sesión para continuar." },
      { status: 401 },
    );
  const parsed = locationIdSchema.safeParse((await context.params).locationId);
  if (!parsed.success)
    return NextResponse.json({ error: "Puerto no válido." }, { status: 422 });
  try {
    await checkRateLimit(`${email}:weather-daily`, 30);
    const forecast = await getPortForecast(parsed.data);
    return NextResponse.json({
      location: forecast.location,
      daily: forecast.daily,
      fetchedAt: forecast.fetchedAt,
      isStale: forecast.isStale,
    });
  } catch {
    return NextResponse.json(
      { error: "No pudimos consultar el pronóstico diario." },
      { status: 503 },
    );
  }
}

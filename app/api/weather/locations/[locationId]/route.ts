import { NextRequest, NextResponse } from "next/server";
import { requestIdentity } from "@/lib/server/auth";
import { locationIdSchema } from "@/lib/weather/schemas";
import { checkRateLimit, getPortForecast } from "@/lib/weather/service";
import {
  WeatherLocationNotFoundError,
  WeatherUnavailableError,
} from "@/lib/weather/errors";

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
    await checkRateLimit(`${email}:weather-forecast`, 30);
    return NextResponse.json(
      await getPortForecast(
        parsed.data,
        request.headers.get("x-request-id") || crypto.randomUUID(),
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No pudimos consultar las condiciones en este momento.";
    if (error instanceof WeatherLocationNotFoundError)
      return NextResponse.json({ error: message }, { status: 404 });
    if (
      error instanceof WeatherUnavailableError &&
      message.includes("demasiadas")
    )
      return NextResponse.json(
        { error: message },
        { status: 429, headers: { "retry-after": "60" } },
      );
    console.error("weather_forecast_failed", message);
    return NextResponse.json(
      { error: "No pudimos consultar las condiciones en este momento." },
      { status: 503 },
    );
  }
}

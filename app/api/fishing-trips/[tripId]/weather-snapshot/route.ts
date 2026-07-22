import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestIdentity } from "@/lib/server/auth";
import { captureTripWeather, checkRateLimit } from "@/lib/weather/service";
import { WeatherLocationNotFoundError } from "@/lib/weather/errors";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  const email = requestIdentity(request);
  if (!email)
    return NextResponse.json(
      { error: "Inicia sesión para continuar." },
      { status: 401 },
    );
  const parsed = z
    .string()
    .uuid()
    .safeParse((await context.params).tripId);
  if (!parsed.success)
    return NextResponse.json({ error: "Pesca no válida." }, { status: 422 });
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      captureMode?: string;
    };
    await checkRateLimit(`${email}:${parsed.data}:weather-snapshot`, 1, 300);
    return NextResponse.json({
      ok: true,
      snapshot: await captureTripWeather(
        parsed.data,
        email,
        payload.captureMode !== "auto",
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No pudimos guardar las condiciones.";
    if (error instanceof WeatherLocationNotFoundError)
      return NextResponse.json({ error: message }, { status: 403 });
    if (message.includes("demasiadas"))
      return NextResponse.json(
        {
          error:
            "Puedes actualizar las condiciones de esta pesca una vez cada cinco minutos.",
        },
        { status: 429 },
      );
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

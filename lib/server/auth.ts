import type { NextRequest } from "next/server";
import { readSessionEmail } from "@/lib/server/session";

export function requestIdentity(request: NextRequest) {
  const header = request.headers.get("oai-authenticated-user-email");
  const session = readSessionEmail(request);
  const local =
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";
  return (
    header?.trim().toLowerCase() ||
    session ||
    (local ? "capitan@gofishing.local" : null)
  );
}

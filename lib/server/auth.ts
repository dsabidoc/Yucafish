import type { NextRequest } from "next/server";

export function requestIdentity(request: NextRequest) {
  const header = request.headers.get("oai-authenticated-user-email");
  const local = request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";
  return header?.trim().toLowerCase() || (local ? "capitan@yucafish.local" : null);
}

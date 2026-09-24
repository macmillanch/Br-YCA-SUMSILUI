import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { SESSION_COOKIE, destroySession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    // Signing out must work even when the database is unreachable. The row
    // expires on its TTL index; the cookie is what actually stops the session.
    await destroySession(token).catch(() => undefined);
  }

  // 204 carries no body, so the client never has to parse a response it ignores.
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

import type { NextRequest } from "next/server";
import { fail, fromError, ok } from "@/lib/api-response";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/users";

/**
 * Reads the session directly instead of going through `requireRole`: "who am I"
 * has no allowlist, and `[]` there means super-admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return fail(401, "unauthenticated", "Please sign in.");
    const ctx = await resolveSession(token);
    if (!ctx) return fail(401, "session_expired", "Your session has expired.");
    return ok({ user: toPublicUser(ctx.user) });
  } catch (error) {
    return fromError(error);
  }
}

import type { NextRequest } from "next/server";
import { fail } from "@/lib/api-response";
import type { AuthContext, Role } from "@/lib/types";
import { SESSION_COOKIE, resolveSession } from "./session";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * `super_admin` passes every allowlist implicitly, so adding a new role-gated
 * route can never accidentally lock out the account that maintains the site.
 * An empty allowlist therefore means super-admin only.
 */
export function canAccess(role: Role, allowed: readonly Role[]): boolean {
  return role === "super_admin" || allowed.includes(role);
}

/**
 * The cookie is SameSite=Lax, which already blocks cross-site POSTs; this is
 * the second lock. A missing Origin means a non-browser client, which CSRF
 * cannot describe, so it passes.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

/** The single authorisation gate. Every mutating API route goes through here. */
export async function requireRole(
  request: NextRequest,
  allowed: readonly Role[],
  handler: (ctx: AuthContext) => Promise<Response>,
): Promise<Response> {
  if (MUTATING.has(request.method) && !isSameOrigin(request)) {
    return fail(403, "csrf", "Cross-site request blocked.");
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return fail(401, "unauthenticated", "Please sign in.");

  const ctx = await resolveSession(token);
  if (!ctx) return fail(401, "session_expired", "Your session has expired. Please sign in again.");
  if (!canAccess(ctx.user.role, allowed)) {
    return fail(403, "forbidden", "Your role does not allow this action.");
  }

  return handler(ctx);
}

import { cookies } from "next/headers";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/require-role";
import type { AuthContext, Role } from "@/lib/types";

/**
 * Middleware and the admin layout already stop a stranger, but neither decides
 * *roles*, and an admin page reads its data on the server — so the page has to
 * check for itself or the HTML would carry a list it should not show. The API
 * checks again on the way in; a page-level gate is a courtesy, never the lock.
 */
export async function readAdminContext(): Promise<AuthContext | null> {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value ?? "");
}

export function maySee(ctx: AuthContext | null, allowed: readonly Role[]): boolean {
  return ctx !== null && canAccess(ctx.user.role, allowed);
}

import type { NextRequest } from "next/server";
import { fail, fromError, ok } from "@/lib/api-response";
import { ipOf } from "@/lib/auth/client-ip";
import { attemptKey, checkLocked, clearAttempts, recordFailure } from "@/lib/auth/login-attempts";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { isSameOrigin } from "@/lib/auth/require-role";
import { SESSION_COOKIE, createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { findUserByEmail, toPublicUser, touchLastLogin } from "@/lib/users";
import { LOGIN_SCHEMA } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  try {
    // Login mints a session, so a cross-site request here would plant the
    // attacker's own session on the victim — the same CSRF class as a write.
    if (!isSameOrigin(request)) {
      return fail(403, "csrf", "Cross-site request blocked.");
    }

    const parsed = LOGIN_SCHEMA.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail(400, "validation_failed", "Email and password are required.");
    }
    const { email, password } = parsed.data;
    const key = attemptKey(email, ipOf(request));

    const lock = await checkLocked(key);
    if (!lock.allowed) {
      const minutes = Math.ceil(lock.retryAfterSec / 60);
      return fail(
        429,
        "rate_limited",
        `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      );
    }

    const user = await findUserByEmail(email);
    const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !user.active || !matches) {
      await recordFailure(key);
      return fail(401, "invalid_credentials", "Email or password is incorrect.");
    }

    await clearAttempts(key);
    const { token, expiresAt } = await createSession(
      user._id,
      request.headers.get("user-agent") ?? undefined,
    );
    await touchLastLogin(user._id);

    const response = ok({ user: toPublicUser(user) });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return response;
  } catch (error) {
    return fromError(error);
  }
}

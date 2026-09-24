import { COLLECTIONS } from "@/lib/index-specs";
import { collection } from "@/lib/db";
import type { LoginAttemptDoc } from "@/lib/types";

export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

/**
 * Email and IP together, so an attacker hammering one account from one address
 * cannot lock out that account for the whole organisation.
 */
export function attemptKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip || "unknown"}`;
}

/**
 * The window opens at the first failure and is not extended by later ones, so
 * a lock always clears on its own. Pure so the boundary cases are testable
 * without a database.
 */
export function computeLock(
  state: { count: number; firstAt: number } | null,
  now: number,
  max = MAX_ATTEMPTS,
  windowMs = WINDOW_MS,
): { allowed: boolean; retryAfterSec: number } {
  if (!state || state.count < max) return { allowed: true, retryAfterSec: 0 };
  const remaining = state.firstAt + windowMs - now;
  if (remaining <= 0) return { allowed: true, retryAfterSec: 0 };
  return { allowed: false, retryAfterSec: Math.ceil(remaining / 1000) };
}

export async function checkLocked(
  key: string,
  now = new Date(),
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const attempts = await collection<LoginAttemptDoc>(COLLECTIONS.loginAttempts);
  const doc = await attempts.findOne({ key, expiresAt: { $gt: now } });
  if (!doc) return { allowed: true, retryAfterSec: 0 };
  return computeLock({ count: doc.count, firstAt: doc.firstAt.getTime() }, now.getTime());
}

export async function recordFailure(key: string, now = new Date()): Promise<void> {
  const attempts = await collection<LoginAttemptDoc>(COLLECTIONS.loginAttempts);
  const existing = await attempts.findOne({ key, expiresAt: { $gt: now } });
  if (existing) {
    await attempts.updateOne({ key }, { $inc: { count: 1 } });
    return;
  }
  await attempts.updateOne(
    { key },
    { $set: { key, count: 1, firstAt: now, expiresAt: new Date(now.getTime() + WINDOW_MS) } },
    { upsert: true },
  );
}

export async function clearAttempts(key: string): Promise<void> {
  const attempts = await collection<LoginAttemptDoc>(COLLECTIONS.loginAttempts);
  await attempts.deleteOne({ key });
}

import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/index-specs";
import { collection } from "@/lib/db";
import type { AuthContext, SessionDoc, UserDoc } from "@/lib/types";

export const SESSION_COOKIE = "yca_session";
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Only the digest is stored, so a database leak cannot be replayed as cookies.
 * The token is random, not signed, which is why there is no session secret.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isSessionLive(input: { expiresAt: Date; active: boolean }, now: Date): boolean {
  return input.active && now.getTime() < input.expiresAt.getTime();
}

export async function createSession(
  userId: ObjectId,
  userAgent: string | undefined,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const doc: SessionDoc = {
    _id: new ObjectId(),
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    createdAt: now,
    userAgent: userAgent?.slice(0, 200),
  };
  const sessions = await collection<SessionDoc>(COLLECTIONS.sessions);
  await sessions.insertOne(doc);
  return { token, expiresAt };
}

export async function resolveSession(token: string, now = new Date()): Promise<AuthContext | null> {
  const sessions = await collection<SessionDoc>(COLLECTIONS.sessions);
  const session = await sessions.findOne({ tokenHash: hashToken(token) });
  if (!session) return null;

  const users = await collection<UserDoc>(COLLECTIONS.users);
  const user = await users.findOne({ _id: session.userId });
  if (!user) {
    await sessions.deleteOne({ _id: session._id }).catch(() => undefined);
    return null;
  }
  if (!isSessionLive({ expiresAt: session.expiresAt, active: user.active }, now)) {
    await sessions.deleteOne({ _id: session._id }).catch(() => undefined);
    return null;
  }
  return { user, sessionId: session._id };
}

export async function destroySession(token: string): Promise<void> {
  const sessions = await collection<SessionDoc>(COLLECTIONS.sessions);
  await sessions.deleteOne({ tokenHash: hashToken(token) });
}

/** Used when a user is deactivated or a password changes, so no old cookie survives. */
export async function destroySessionsForUser(userId: ObjectId): Promise<number> {
  const sessions = await collection<SessionDoc>(COLLECTIONS.sessions);
  const result = await sessions.deleteMany({ userId });
  return result.deletedCount;
}

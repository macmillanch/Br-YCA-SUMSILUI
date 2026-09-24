import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  hashToken,
  isSessionLive,
  newSessionToken,
} from "@/lib/auth/session";

describe("token shape", () => {
  it("issues 32 random bytes, url-safe, and never repeats", () => {
    const tokens = new Set(Array.from({ length: 50 }, newSessionToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("hashes deterministically to 64 hex characters", () => {
    const token = newSessionToken();
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });

  it("names the cookie exactly as the spec requires", () => {
    expect(SESSION_COOKIE).toBe("yca_session");
    expect(SESSION_TTL_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });
});

describe("isSessionLive", () => {
  const now = new Date("2026-09-24T10:00:00.000Z");

  it("accepts a live session for an active user", () => {
    expect(
      isSessionLive({ expiresAt: new Date(now.getTime() + 1000), active: true }, now),
    ).toBe(true);
  });

  it("rejects exactly at expiry", () => {
    expect(isSessionLive({ expiresAt: now, active: true }, now)).toBe(false);
  });

  it("rejects a session belonging to a deactivated user", () => {
    expect(
      isSessionLive({ expiresAt: new Date(now.getTime() + 60_000), active: false }, now),
    ).toBe(false);
  });

  it("rejects a session that expired a second ago", () => {
    expect(
      isSessionLive({ expiresAt: new Date(now.getTime() - 1000), active: true }, now),
    ).toBe(false);
  });
});

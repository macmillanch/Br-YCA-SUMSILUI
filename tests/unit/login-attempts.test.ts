import { describe, expect, it } from "vitest";
import { attemptKey, computeLock } from "@/lib/auth/login-attempts";

const WINDOW = 15 * 60 * 1000;
const MAX = 5;

describe("attemptKey", () => {
  it("lowercases the email and keeps the ip", () => {
    expect(attemptKey("Treasurer@YCA.In", "203.0.113.7")).toBe("treasurer@yca.in|203.0.113.7");
  });
});

describe("computeLock", () => {
  it("allows the first attempt", () => {
    expect(computeLock(null, 1_000, MAX, WINDOW)).toEqual({ allowed: true, retryAfterSec: 0 });
  });

  it("allows up to the maximum", () => {
    const state = { count: MAX - 1, firstAt: 1_000 };
    expect(computeLock(state, 2_000, MAX, WINDOW).allowed).toBe(true);
  });

  it("blocks at the maximum and reports the remaining window", () => {
    const state = { count: MAX, firstAt: 0 };
    const result = computeLock(state, 60_000, MAX, WINDOW);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBe(14 * 60);
  });

  it("resets once the window has elapsed", () => {
    const state = { count: MAX, firstAt: 0 };
    expect(computeLock(state, WINDOW, MAX, WINDOW).allowed).toBe(true);
  });

  it("never reports a negative retry", () => {
    const state = { count: MAX, firstAt: 0 };
    expect(computeLock(state, WINDOW + 1, MAX, WINDOW).retryAfterSec).toBe(0);
  });
});

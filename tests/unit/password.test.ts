import { describe, expect, it } from "vitest";
import {
  DUMMY_HASH,
  PASSWORD_MIN_LENGTH,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";

describe("hashPassword", () => {
  it("verifies its own output and rejects a near miss", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse battery!", hash)).toBe(false);
  });

  it("salts, so the same password hashes differently twice", async () => {
    expect(await hashPassword("aaaaaaaaaa")).not.toEqual(await hashPassword("aaaaaaaaaa"));
  });
});

describe("DUMMY_HASH", () => {
  it("is a real bcrypt string so a missing user still costs a compare", async () => {
    expect(DUMMY_HASH).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false);
  });
});

describe("generateTemporaryPassword", () => {
  it("is long enough to satisfy the policy and varies", () => {
    const first = generateTemporaryPassword();
    expect(first.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    expect(new Set(Array.from({ length: 20 }, generateTemporaryPassword)).size).toBeGreaterThan(15);
  });
});

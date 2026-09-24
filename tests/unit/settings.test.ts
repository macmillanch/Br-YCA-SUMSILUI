import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA } from "@/lib/settings";

describe("SETTINGS_SCHEMA", () => {
  it("accepts the shipped defaults", () => {
    expect(() => SETTINGS_SCHEMA.parse(DEFAULT_SETTINGS)).not.toThrow();
  });

  it("rejects a blank branch name", () => {
    const result = SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, branchName: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email, URL and UPI id", () => {
    for (const [field, value] of [
      ["email", "not-an-email"],
      ["facebookUrl", "javascript:alert(1)"],
      ["upiId", "!!broken!!"],
    ] as const) {
      expect(SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, [field]: value }).success).toBe(
        false,
      );
    }
  });

  it("accepts an empty contact field, because a branch may not have one yet", () => {
    expect(
      SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, whatsappNumber: "" }).success,
    ).toBe(true);
  });

  it("clamps the founding year to a plausible range", () => {
    expect(
      SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, branchFoundedYear: 1899 }).success,
    ).toBe(false);
    expect(
      SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, branchFoundedYear: 3000 }).success,
    ).toBe(false);
    expect(
      SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, branchFoundedYear: null }).success,
    ).toBe(true);
  });

  it("strips whitespace from every text field", () => {
    const parsed = SETTINGS_SCHEMA.parse({
      ...DEFAULT_SETTINGS,
      branchName: "  Br. YCA Sumsilui  ",
    });
    expect(parsed.branchName).toBe("Br. YCA Sumsilui");
  });
});

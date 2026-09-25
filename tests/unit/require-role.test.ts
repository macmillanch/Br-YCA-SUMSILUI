import { describe, expect, it } from "vitest";
import { canAccess, isSameOrigin } from "@/lib/auth/require-role";
import { MANAGE_FINANCE, REOPEN_FINANCIAL_YEAR } from "@/lib/finance";

describe("canAccess", () => {
  it("grants super_admin every allowlist without naming them", () => {
    expect(canAccess("super_admin", ["treasurer"])).toBe(true);
    expect(canAccess("super_admin", [])).toBe(true);
  });

  it("grants a listed role", () => {
    expect(canAccess("treasurer", ["treasurer"])).toBe(true);
    expect(canAccess("editor", ["editor", "treasurer"])).toBe(true);
  });

  it("refuses an unlisted role", () => {
    expect(canAccess("editor", ["treasurer"])).toBe(false);
    expect(canAccess("treasurer", ["editor"])).toBe(false);
  });
});

/**
 * §8: closing a year is the safe direction, so the Treasurer may do it;
 * reopening one is not, so nobody but a super-admin may, and the reason for it
 * is kept. Two allowlists, one file, so a screen cannot offer the wrong button.
 */
describe("the finance allowlists", () => {
  it("let the treasurer keep and close the books", () => {
    expect(canAccess("treasurer", MANAGE_FINANCE)).toBe(true);
    expect(canAccess("super_admin", MANAGE_FINANCE)).toBe(true);
  });

  it("keep an editor out of the ledger entirely", () => {
    expect(canAccess("editor", MANAGE_FINANCE)).toBe(false);
  });

  it("let only a super-admin reopen a closed year", () => {
    expect(canAccess("treasurer", REOPEN_FINANCIAL_YEAR)).toBe(false);
    expect(canAccess("editor", REOPEN_FINANCIAL_YEAR)).toBe(false);
    expect(canAccess("super_admin", REOPEN_FINANCIAL_YEAR)).toBe(true);
  });
});

function requestWith(headers: Record<string, string>, host = "ycasumsilui.vercel.app") {
  return {
    headers: new Headers(headers),
    nextUrl: new URL(`https://${host}/api/settings`),
  } as never;
}

describe("isSameOrigin", () => {
  it("accepts a matching Origin", () => {
    expect(isSameOrigin(requestWith({ Origin: "https://ycasumsilui.vercel.app" }))).toBe(true);
  });

  it("refuses a cross-site Origin", () => {
    expect(isSameOrigin(requestWith({ Origin: "https://evil.example" }))).toBe(false);
  });

  it("refuses a malformed Origin rather than crashing", () => {
    expect(isSameOrigin(requestWith({ Origin: "not a url" }))).toBe(false);
  });

  it("refuses a mismatched port", () => {
    expect(isSameOrigin(requestWith({ Origin: "https://ycasumsilui.vercel.app:8443" }))).toBe(false);
  });

  it("accepts a request with no Origin, which is a non-browser client", () => {
    expect(isSameOrigin(requestWith({}))).toBe(true);
  });
});

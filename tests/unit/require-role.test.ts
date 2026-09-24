import { describe, expect, it } from "vitest";
import { canAccess, isSameOrigin } from "@/lib/auth/require-role";

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

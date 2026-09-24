import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");

describe("design tokens", () => {
  it("defines every colour from the spec", () => {
    for (const [token, value] of Object.entries({
      "--color-green-900": "#06411F",
      "--color-green-700": "#0B7A3E",
      "--color-green-500": "#12A05A",
      "--color-green-100": "#E3F2E8",
      "--color-red-700": "#C8102E",
      "--color-red-100": "#FBE6E9",
      "--color-ink": "#14231B",
      "--color-ink-muted": "#5A6B60",
      "--color-paper": "#FFFFFF",
      "--color-paper-alt": "#F7F9F7",
      "--color-line": "#DCE5DE",
    })) {
      expect(css).toContain(`${token}: ${value};`);
    }
  });

  it("exposes display and body fonts as CSS variables", () => {
    expect(css).toContain("--font-display");
    expect(css).toContain("--font-sans");
  });

  it("caps content at 1140px", () => {
    expect(css).toContain("max-width: 1140px");
  });
});

describe("root layout", () => {
  it("self-hosts Fraunces and Public Sans instead of requesting Google Fonts at runtime", () => {
    expect(layout).toContain("next/font/google");
    expect(layout).toContain("Fraunces");
    expect(layout).toContain("Public_Sans");
    expect(layout).not.toContain("fonts.googleapis.com");
  });

  it("offers a skip link and one main landmark", () => {
    expect(layout).toContain("Skip to content");
    expect(layout).toContain('id="main"');
  });
});

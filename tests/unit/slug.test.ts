import { describe, expect, it } from "vitest";
import { SLUG_MAX_LENGTH, isSlug, slugFromTitle } from "@/lib/slug";

describe("slugFromTitle", () => {
  it("turns an English heading into a web address", () => {
    expect(slugFromTitle("Annual General Meeting")).toBe("annual-general-meeting");
  });

  it("replaces punctuation and line ornament with a single hyphen", () => {
    expect(slugFromTitle("Blood-donation camp, 2026!")).toBe("blood-donation-camp-2026");
    expect(slugFromTitle("Road repair — upper lines")).toBe("road-repair-upper-lines");
  });

  it("drops accents rather than mangling them", () => {
    expect(slugFromTitle("Renewal of the résumé list")).toBe("renewal-of-the-resume-list");
  });

  it("trims hyphens from both ends", () => {
    expect(slugFromTitle("  -- notice --  ")).toBe("notice");
  });

  it("never ends on a hyphen left behind by truncation", () => {
    const slug = slugFromTitle("word ".repeat(30).trim());
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("returns nothing for a title with no latin letters, so the form asks", () => {
    expect(slugFromTitle("𑄃𑄩 𑄡𑄴𑄞")).toBe("");
    expect(slugFromTitle("")).toBe("");
  });
});

describe("isSlug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    expect(isSlug("agm-2026")).toBe(true);
    expect(isSlug("notice")).toBe(true);
  });

  it("rejects what a browser would not treat as one path segment", () => {
    expect(isSlug("AGM-2026")).toBe(false);
    expect(isSlug("agm_2026")).toBe(false);
    expect(isSlug("agm--2026")).toBe(false);
    expect(isSlug("-agm")).toBe(false);
    expect(isSlug("agm/2026")).toBe(false);
    expect(isSlug("")).toBe(false);
  });
});

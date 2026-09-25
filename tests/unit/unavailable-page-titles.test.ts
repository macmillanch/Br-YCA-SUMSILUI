import { describe, expect, it, vi } from "vitest";

/**
 * §9 says an unreachable database is not an empty one, and the rule is about what
 * the branch *claims* — which includes the line in a browser tab. A reader who
 * followed a link to a notice and got a tab saying "Notice not found" has been
 * told the notice does not exist, in the same screen that says it could not be
 * read. These tests hold the two title states apart.
 */

const reads = vi.hoisted((): { notice: unknown; work: unknown } => ({
  notice: { state: "ready" },
  work: { state: "ready" },
}));

vi.mock("@/lib/content", () => ({
  getNoticeBySlug: async () => reads.notice,
  getNotices: async () => ({ state: "ready", items: [] }),
  getWorkBySlug: async () => reads.work,
  getWorks: async () => ({ state: "ready", items: [] }),
}));

const noticeMeta = async () => {
  const { generateMetadata } = await import("@/app/notices/[slug]/page");
  return generateMetadata({ params: Promise.resolve({ slug: "a-notice" }) });
};

const workMeta = async () => {
  const { generateMetadata } = await import("@/app/works/[slug]/page");
  return generateMetadata({ params: Promise.resolve({ slug: "a-work" }) });
};

describe("a notice's title while the database is unreachable", () => {
  it("does not say the notice is missing", async () => {
    reads.notice = { state: "unavailable" };
    const meta = await noticeMeta();
    expect(meta.title).toBeDefined();
    expect(String(meta.title)).not.toMatch(/not found|does not exist|missing/i);
  });

  it("says it could not be read", async () => {
    reads.notice = { state: "unavailable" };
    expect(String((await noticeMeta()).title)).toMatch(/temporarily unavailable/i);
  });

  it("still says so when the notice genuinely is not there", async () => {
    reads.notice = { state: "missing" };
    expect(String((await noticeMeta()).title)).toMatch(/not found/i);
  });

  it("is the notice's own name when it could be read", async () => {
    reads.notice = {
      state: "ready",
      notice: {
        slug: "a-notice",
        title: "Annual function notice",
        excerpt: "The annual function is on Sunday.",
      },
    };
    expect(String((await noticeMeta()).title)).toBe("Annual function notice");
  });
});

describe("a work's title while the database is unreachable", () => {
  it("does not say the work is missing", async () => {
    reads.work = { state: "unavailable" };
    const meta = await workMeta();
    expect(meta.title).toBeDefined();
    expect(String(meta.title)).not.toMatch(/not found|does not exist|missing/i);
  });

  it("says it could not be read", async () => {
    reads.work = { state: "unavailable" };
    expect(String((await workMeta()).title)).toMatch(/temporarily unavailable/i);
  });

  it("still says so when the work genuinely is not there", async () => {
    reads.work = { state: "missing" };
    expect(String((await workMeta()).title)).toMatch(/not found/i);
  });

  it("is the work's own name when it could be read", async () => {
    reads.work = {
      state: "ready",
      project: { slug: "a-work", title: "Footpath repair", description: "Two hundred metres." },
      updates: [],
    };
    expect(String((await workMeta()).title)).toBe("Footpath repair");
  });
});

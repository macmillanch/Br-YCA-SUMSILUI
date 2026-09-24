import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { buildNoticeDoc, excerptOf, toPublicNotice } from "@/lib/notices";
import { NOTICE_SCHEMA, effectiveSlug, type NoticeInput } from "@/lib/validation/notices";
import type { NoticeDoc } from "@/lib/types";

const base = {
  kind: "notice",
  status: "draft",
  titleEn: "Annual General Meeting",
  bodyEn: "All members are requested to attend.",
  slug: "",
  eventDate: "",
  venue: "",
  titleBn: "",
  bodyBn: "",
  titleCdp: "",
  bodyCdp: "",
};

function input(overrides: Partial<typeof base> = {}): NoticeInput {
  return NOTICE_SCHEMA.parse({ ...base, ...overrides });
}

function doc(overrides: Partial<NoticeDoc> = {}): NoticeDoc {
  return {
    _id: new ObjectId(),
    slug: "annual-general-meeting",
    kind: "notice",
    status: "published",
    titleEn: "Annual General Meeting",
    bodyEn: "All members are requested to attend.",
    publishedAt: new Date("2026-09-23T18:30:00Z"),
    attachments: [],
    authorId: null,
    createdAt: new Date("2026-09-20T10:00:00Z"),
    updatedAt: new Date("2026-09-20T10:00:00Z"),
    ...overrides,
  };
}

describe("NOTICE_SCHEMA", () => {
  it("derives a web address from the English title when none is typed", () => {
    expect(effectiveSlug(input({ titleEn: "Repair of the roadside drain" }))).toBe(
      "repair-of-the-roadside-drain",
    );
  });

  it("refuses a notice whose title cannot produce an address", () => {
    const parsed = NOTICE_SCHEMA.safeParse({ ...base, titleEn: "𑄃𑄩 𑄡𑄴𑄞 𑄟𑄧𑄢𑄴" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["slug"]);
    }
  });

  it("refuses a translation that is only half written", () => {
    const parsed = NOTICE_SCHEMA.safeParse({
      ...input(),
      titleCdp: "",
      bodyCdp: "𑄃𑄩 𑄡𑄴𑄞",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === "titleCdp")).toBe(true);
    }
  });

  it("accepts a notice in English, Bangla and Chakma at once", () => {
    const parsed = NOTICE_SCHEMA.safeParse({
      ...input(),
      titleBn: "বার্ষিক সভা",
      bodyBn: "সকল সদস্যকে উপস্থিত থাকার জন্য বলা হয়েছে।",
      titleCdp: "𑄴𑄛𑄳𑄡𑄧",
      bodyCdp: "𑄃𑄩 𑄡𑄴𑄞",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an event date that is not a real calendar day", () => {
    const parsed = NOTICE_SCHEMA.safeParse({ ...input(), eventDate: "2026-13-40" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["eventDate"]);
    }
  });
});

describe("buildNoticeDoc", () => {
  it("leaves a draft undated", () => {
    const created = buildNoticeDoc(input({ status: "draft" }), null);
    expect(created.publishedAt).toBeNull();
    expect(created.slug).toBe("annual-general-meeting");
  });

  it("stores nothing for a language that was left blank", () => {
    const created = buildNoticeDoc(input(), null);
    expect("titleBn" in created).toBe(false);
    expect("bodyBn" in created).toBe(false);
    expect("venue" in created).toBe(false);
  });

  it("stamps the date on first publication and keeps it afterwards", () => {
    const draft = buildNoticeDoc(input({ status: "draft" }), null);
    const published = buildNoticeDoc(input({ status: "published" }), null, draft);
    expect(published.publishedAt).toBeInstanceOf(Date);

    const edited = buildNoticeDoc(
      input({ status: "published", titleEn: "Annual General Meeting — revised" }),
      null,
      published,
    );
    expect(edited.publishedAt).toEqual(published.publishedAt);
  });

  it("withdraws without losing the original date or the attachments", () => {
    const withFile = doc({ attachments: [{ name: "note.pdf", url: "https://x/y", mimeType: "application/pdf", size: 1 }] });
    const withdrawn = buildNoticeDoc(input({ status: "draft" }), null, withFile);
    expect(withdrawn.status).toBe("draft");
    expect(withdrawn.publishedAt).toEqual(withFile.publishedAt);
    expect(withdrawn.attachments).toHaveLength(1);
  });

  it("keeps the identity and the first author through an edit", () => {
    const author = new ObjectId();
    const existing = doc({ authorId: author });
    const edited = buildNoticeDoc(input(), new ObjectId(), existing);
    expect(edited._id).toEqual(existing._id);
    expect(edited.authorId).toEqual(author);
    expect(edited.createdAt).toEqual(existing.createdAt);
  });
});

describe("excerptOf", () => {
  it("takes the opening paragraph", () => {
    expect(excerptOf("First paragraph.\n\nSecond one.")).toBe("First paragraph.");
  });

  it("cuts a long paragraph at a space rather than mid-word", () => {
    const excerpt = excerptOf("word ".repeat(100), 40);
    expect(excerpt.length).toBeLessThanOrEqual(41);
    expect(excerpt.endsWith("word…")).toBe(true);
  });
});

describe("toPublicNotice", () => {
  it("offers only the languages that were written", () => {
    const notice = toPublicNotice(
      doc({ bodyBn: "সকল সদস্যকে উপস্থিত থাকার জন্য বলা হয়েছে।", titleBn: "বার্ষিক সভা" }),
    );
    expect(notice.translations.map((entry) => entry.language)).toEqual(["bn"]);
    expect(notice.translations[0]?.label).toBe("Bangla");
  });

  it("dates the notice by the day the branch sees it", () => {
    // 23:00 UTC on the 23rd is already the 24th in Mizoram.
    expect(toPublicNotice(doc()).publishedOn).toBe("2026-09-24");
  });

  it("carries the attachments a reader may want to open", () => {
    const notice = toPublicNotice(
      doc({ attachments: [{ name: "Agenda", url: "https://files.example/agenda.pdf", mimeType: "application/pdf", size: 20480 }] }),
    );
    expect(notice.attachments).toEqual([{ name: "Agenda", url: "https://files.example/agenda.pdf" }]);
  });
});

import { ObjectId, type Filter } from "mongodb";
import { istCalendarDate } from "@/lib/dates";
import { collection } from "@/lib/db";
import { COLLECTIONS } from "@/lib/index-specs";
import type { NoticeDoc, NoticeKind, NoticeStatus } from "@/lib/types";
import { effectiveSlug, type NoticeInput } from "@/lib/validation/notices";
import type { PublicNotice } from "@/lib/content";

/**
 * Notices are the one place where a reader may need a language the site cannot
 * assume, so every notice carries whatever translations the branch typed and
 * the page offers exactly those — no empty panel, no English dressed up as a
 * translation.
 */

export type WriteResult = "written" | "duplicate_slug" | "not_found";

export type NoticeFilter = { kind?: NoticeKind; status?: NoticeStatus };

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

/** `11000` is the unique index saying no; anything else means the row is gone. */
function describeWriteError(error: unknown): WriteResult {
  return isDuplicateKey(error) ? "duplicate_slug" : "not_found";
}

/**
 * The driver writes an explicit `undefined` as `null`, so an absent translation
 * would come back as a value the type says cannot happen. Drop the keys.
 */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function only(value: string): string | undefined {
  return value === "" ? undefined : value;
}

/**
 * `publishedAt` is stamped the first time a notice goes out and never moved
 * after that. Withdrawing a notice and putting it back up is the same record
 * with the same date, not a fresh announcement wearing an old one's clothes.
 */
export function buildNoticeDoc(
  input: NoticeInput,
  authorId: ObjectId | null,
  existing?: NoticeDoc,
): NoticeDoc {
  const now = new Date();
  return compact<NoticeDoc>({
    _id: existing?._id ?? new ObjectId(),
    slug: effectiveSlug(input),
    kind: input.kind,
    status: input.status,
    titleEn: input.titleEn,
    bodyEn: input.bodyEn,
    titleBn: only(input.titleBn),
    bodyBn: only(input.bodyBn),
    titleCdp: only(input.titleCdp),
    bodyCdp: only(input.bodyCdp),
    publishedAt:
      input.status === "published" ? (existing?.publishedAt ?? now) : (existing?.publishedAt ?? null),
    eventDate: only(input.eventDate),
    venue: only(input.venue),
    // Attachments arrive through the upload screen, not this form, so an edit
    // of the text must not quietly drop the files already hanging off a notice.
    attachments: existing?.attachments ?? [],
    authorId: existing?.authorId ?? authorId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function insertNotice(doc: NoticeDoc): Promise<WriteResult> {
  const notices = await collection<NoticeDoc>(COLLECTIONS.notices);
  try {
    await notices.insertOne(doc);
    return "written";
  } catch (error) {
    return describeWriteError(error);
  }
}

export async function replaceNotice(doc: NoticeDoc): Promise<WriteResult> {
  const notices = await collection<NoticeDoc>(COLLECTIONS.notices);
  try {
    const result = await notices.replaceOne({ _id: doc._id }, doc);
    return result.matchedCount === 0 ? "not_found" : "written";
  } catch (error) {
    return describeWriteError(error);
  }
}

export async function getNotice(id: ObjectId): Promise<NoticeDoc | null> {
  const notices = await collection<NoticeDoc>(COLLECTIONS.notices);
  return notices.findOne({ _id: id });
}

/** Newest change first: an editor's list is about what was being worked on. */
export async function listNotices(filter: NoticeFilter = {}): Promise<NoticeDoc[]> {
  const notices = await collection<NoticeDoc>(COLLECTIONS.notices);
  const query: Filter<NoticeDoc> = {};
  if (filter.kind) query.kind = filter.kind;
  if (filter.status) query.status = filter.status;
  return notices.find(query).sort({ updatedAt: -1 }).limit(200).toArray();
}

function publishedQuery(kind?: NoticeKind): Filter<NoticeDoc> {
  return kind ? { status: "published", kind } : { status: "published" };
}

export async function listPublishedNotices(kind?: NoticeKind, limit = 50): Promise<PublicNotice[]> {
  const notices = await collection<NoticeDoc>(COLLECTIONS.notices);
  const docs = await notices
    .find(publishedQuery(kind))
    .sort({ publishedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toPublicNotice);
}

export async function getPublishedNoticeBySlug(slug: string): Promise<PublicNotice | null> {
  const notices = await collection<NoticeDoc>(COLLECTIONS.notices);
  const doc = await notices.findOne({ status: "published", slug });
  return doc ? toPublicNotice(doc) : null;
}

/**
 * The one-click publish and withdraw in the admin list. It writes through the
 * same replace path as the form so the two cannot disagree about what publishing
 * does to `publishedAt`.
 */
export async function setNoticeStatus(id: ObjectId, status: NoticeStatus): Promise<NoticeDoc | null> {
  const notices = await collection<NoticeDoc>(COLLECTIONS.notices);
  const existing = await notices.findOne({ _id: id });
  if (!existing) return null;

  const doc: NoticeDoc = {
    ...existing,
    status,
    publishedAt: status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
    updatedAt: new Date(),
  };
  await notices.replaceOne({ _id: id }, doc);
  return doc;
}

export async function deleteNotice(id: ObjectId): Promise<boolean> {
  const notices = await collection<NoticeDoc>(COLLECTIONS.notices);
  return (await notices.deleteOne({ _id: id })).deletedCount > 0;
}

/**
 * What the admin list shows. Kept separate from the public view so a draft's
 * missing publication date reads as "not published" rather than as a blank day.
 */
export type AdminNotice = {
  id: string;
  slug: string;
  kind: NoticeKind;
  status: NoticeStatus;
  titleEn: string;
  publishedOn: string | null;
  updatedOn: string;
  languages: string[];
};

export function toAdminNotice(doc: NoticeDoc): AdminNotice {
  const languages = ["English"];
  if (doc.bodyBn) languages.push("Bangla");
  if (doc.bodyCdp) languages.push("Chakma");
  return {
    id: doc._id.toHexString(),
    slug: doc.slug,
    kind: doc.kind,
    status: doc.status,
    titleEn: doc.titleEn,
    publishedOn: doc.publishedAt ? istCalendarDate(doc.publishedAt) : null,
    updatedOn: istCalendarDate(doc.updatedAt),
    languages,
  };
}

/** The saved document back into the form's own shape, blank where unset. */
export function toFormValues(doc: NoticeDoc): NoticeInput {
  return {
    kind: doc.kind,
    status: doc.status,
    titleEn: doc.titleEn,
    bodyEn: doc.bodyEn,
    slug: doc.slug,
    eventDate: doc.eventDate ?? "",
    venue: doc.venue ?? "",
    titleBn: doc.titleBn ?? "",
    bodyBn: doc.bodyBn ?? "",
    titleCdp: doc.titleCdp ?? "",
    bodyCdp: doc.bodyCdp ?? "",
  };
}

/** The card's preview: the opening paragraph, cut at a word rather than mid-syllable. */
export function excerptOf(body: string, maxLength = 180): string {
  const first = (body.split(/\n{2,}/)[0] ?? "").trim();
  if (first.length <= maxLength) return first;
  const cut = first.slice(0, maxLength);
  const breakAt = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","));
  return `${cut.slice(0, breakAt > 40 ? breakAt : maxLength).trimEnd()}…`;
}

const LANGUAGE_LABEL = { bn: "Bangla", cdp: "Chakma" } as const;

type NoticeTranslation = PublicNotice["translations"][number];

function translation(
  language: keyof typeof LANGUAGE_LABEL,
  title: string | undefined,
  body: string | undefined,
): NoticeTranslation | null {
  if (!body) return null;
  return { language, label: LANGUAGE_LABEL[language], title: title ?? "", body };
}

export function toPublicNotice(doc: NoticeDoc): PublicNotice {
  const translations = [
    translation("bn", doc.titleBn, doc.bodyBn),
    translation("cdp", doc.titleCdp, doc.bodyCdp),
  ].filter((entry): entry is NoticeTranslation => entry !== null);

  return {
    slug: doc.slug,
    kind: doc.kind,
    title: doc.titleEn,
    publishedOn: doc.publishedAt ? istCalendarDate(doc.publishedAt) : "",
    ...(doc.eventDate ? { eventDate: doc.eventDate } : {}),
    venue: doc.venue ?? null,
    excerpt: excerptOf(doc.bodyEn),
    body: doc.bodyEn,
    translations,
    attachments: doc.attachments.map((file) => ({ name: file.name, url: file.url })),
  };
}

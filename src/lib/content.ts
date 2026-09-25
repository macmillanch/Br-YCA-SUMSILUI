/**
 * Public view-models for the site's content, and the reads behind them.
 *
 * Every sentence and figure here comes from something the branch has typed, or
 * from a ledger entry it has made. Nothing in this file stands in for a record
 * the branch has not supplied: a database that cannot be read says so, and one
 * that is empty reports nothing published — which each page renders as its own
 * standing sentence rather than a gap.
 */

import { getSettings, type SettingsValues } from "@/lib/settings";
import { categoryLabel } from "@/lib/finance-categories";
import {
  listFinancialYears,
  listTransactions,
  yearIsClosed,
} from "@/lib/finance";
import {
  summarise,
  totalsByCategory,
  withRunningBalance,
  type CategoryTotal,
  type LedgerRow,
} from "@/lib/finance-summary";
import {
  type PublicLedgerLine,
  type PublicLedgerRow,
} from "@/lib/finance-ledger";
import { istCalendarDate } from "@/lib/dates";
import { galleryAlbums, recentGalleryItems, type GalleryAlbum, type PublicGalleryItem } from "@/lib/gallery";
import { listMembers, toDirectoryRow, toPublicMember } from "@/lib/members";
import {
  countPublishedNotices,
  getPublishedNoticeBySlug,
  listPublishedNotices,
  listPublishedNoticesWithin,
} from "@/lib/notices";
import { pageInfo, type PageInfo } from "@/lib/pagination";
import { publicProjectBySlug, publicProjects } from "@/lib/projects";
import type { ObjectId } from "mongodb";
import type {
  FinancialYearDoc,
  MemberType,
  NoticeKind,
  ProjectStatus,
  TransactionDoc,
  TransactionType,
} from "@/lib/types";

export type { MemberType, NoticeKind, ProjectStatus };

/** One language a notice was actually written in — never an empty panel. */
export type NoticeTranslation = {
  language: "bn" | "cdp";
  label: string;
  title: string;
  body: string;
};

export type PublicNotice = {
  slug: string;
  kind: NoticeKind;
  title: string;
  /** `YYYY-MM-DD` in the branch's own time zone; empty while a draft. */
  publishedOn: string;
  eventDate?: string;
  venue: string | null;
  excerpt: string;
  body: string;
  translations: readonly NoticeTranslation[];
  attachments: readonly { name: string; url: string }[];
};

/**
 * Public reads report three outcomes, not two. A database that cannot be
 * reached must not turn into a 404 or a blank gap — §9 of the spec asks for the
 * page to stay standing and the section to say it is temporarily unavailable.
 */
export type PublicRead<T> =
  | { state: "ready"; items: T[] }
  | { state: "empty" }
  | { state: "unavailable" };

/** The same three outcomes for one page, where "empty" is a 404 rather than a gap. */
export type NoticeDetail =
  | { state: "ready"; notice: PublicNotice }
  | { state: "missing" }
  | { state: "unavailable" };

/**
 * One work, as the site shows it. The sanctioned amount is the branch's own
 * decision and is typed in the office; what has been spent is never typed — it
 * is summed from the ledger each time a work is read, so a page cannot publish an
 * amount no treasurer entered. The percentage is the branch's own latest dated
 * report, and null until such a report exists — which the card renders as "not
 * reported yet", never as 0%.
 */
export type PublicProject = {
  slug: string;
  title: string;
  description: string;
  location: string | null;
  status: ProjectStatus;
  sanctionedPaise: number;
  beneficiaries: number;
  startDate: string | null;
  targetDate: string | null;
  completedDate: string | null;
  percentComplete: number | null;
  /** The date of the report that percentage came from; null when there is none. */
  reportedOn: string | null;
  /**
   * What the vouchers naming this work have paid out, across every year the
   * branch keeps. Null only when the ledger could not be read — a work nobody
   * has drawn against shows ₹0, which is a fact, not a gap.
   */
  spentPaise: number | null;
  /**
   * That spend as a share of what was sanctioned, so a bar can be drawn beside
   * the progress one. It passes 100 when the work has cost more than the branch
   * sanctioned, and is null when nothing was sanctioned to be a share of.
   */
  budgetSharePct: number | null;
};

/** One dated line on the progress timeline, newest first. */
export type PublicProjectUpdate = {
  date: string;
  text: string;
  percentComplete: number;
  photos: string[];
};

export type WorkDetail =
  | { state: "ready"; project: PublicProject; updates: PublicProjectUpdate[] }
  | { state: "missing" }
  | { state: "unavailable" };

export type FinanceSnapshot = {
  yearLabel: string;
  openingPaise: number;
  incomePaise: number;
  expensePaise: number;
  closingPaise: number;
};

/** One picture on the front-page strip, in the size the store serves it. */
export type GalleryPhoto = {
  url: string;
  thumbUrl: string;
  alt: string;
  caption: string;
};

export type ContactDetails = {
  addressLines: readonly string[];
  phone: string | null;
  email: string | null;
  officeHours: string | null;
  mapUrl: string | null;
};

export type HomepageContent = {
  /** The branch's own words; null until the office-bearers write them in Settings. */
  introduction: string | null;
  notices: readonly PublicNotice[];
  /** True when the notices could not be read at all — not merely none yet. */
  noticesUnavailable: boolean;
  /** The works the branch has under way, read from the database like the notices. */
  projects: readonly PublicProject[];
  projectsUnavailable: boolean;
  finance: FinanceSummaryContent;
  photos: readonly GalleryPhoto[];
  photosUnavailable: boolean;
  contact: ContactDetails;
  contactUnavailable: boolean;
};

export { KIND_LABEL, MEMBER_TYPE_LABEL, STATUS_LABEL } from "@/lib/labels";

export const CONTACT_PLACEHOLDER: ContactDetails = {
  addressLines: ["Mizoram — PIN code to be confirmed"],
  phone: null,
  email: null,
  officeHours: null,
  mapUrl: null,
};

/**
 * The branch's saved details, mapped onto what the public pages show. Blank
 * stays blank: an address no one has typed in renders as "not published yet",
 * never as a plausible-looking guess.
 */
function contactFromSettings(settings: SettingsValues): ContactDetails {
  const addressLines = [settings.addressLine, settings.district, settings.state].filter(
    (line) => line.length > 0,
  );
  return {
    addressLines: addressLines.length > 0 ? addressLines : CONTACT_PLACEHOLDER.addressLines,
    phone: settings.phone || null,
    email: settings.email || null,
    officeHours: null,
    mapUrl: null,
  };
}

/** What the contact blocks show, and whether they were able to look. */
export type ContactContent = {
  contact: ContactDetails;
  /** True when the settings could not be read at all, so the blanks prove nothing. */
  unavailable: boolean;
};

/**
 * Through an outage the details are unreadable, which is not the same claim as
 * "the branch has never given a phone number". So nothing is offered in their
 * place, not even the placeholder line a reader would take for the office address.
 */
export function toContactDetails(settings: SettingsValues | null): ContactContent {
  if (!settings) {
    return {
      contact: { addressLines: [], phone: null, email: null, officeHours: null, mapUrl: null },
      unavailable: true,
    };
  }
  return { contact: contactFromSettings(settings), unavailable: false };
}

/**
 * A settings read that fails must not take the page down with it. The sections
 * that need it say they could not read, so a timeout never becomes a page of
 * blanks that a member would mistake for a branch that has published nothing.
 */
async function loadSettingsOrNull(): Promise<SettingsValues | null> {
  try {
    return await getSettings();
  } catch (error) {
    console.error("site settings are unavailable", error);
    return null;
  }
}

export type BankDetails = {
  accountName: string | null;
  bankName: string | null;
  bankBranch: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  upiId: string | null;
};

const BLANK_BANK: BankDetails = {
  accountName: null,
  bankName: null,
  bankBranch: null,
  accountNumber: null,
  ifsc: null,
  upiId: null,
};

export type BankDetailsContent = {
  bank: BankDetails;
  /** True when the settings could not be read at all, so the blanks prove nothing. */
  unavailable: boolean;
};

/**
 * The donate page promises these came from the Treasurer and not from the
 * template, so every field starts null and only a saved value can fill it.
 * An unreadable settings document is reported separately: a number that is
 * merely unpublished and one that could not be looked up ask the visitor for
 * different things.
 */
export function toBankDetails(settings: SettingsValues | null): BankDetailsContent {
  if (!settings) return { bank: BLANK_BANK, unavailable: true };
  return {
    bank: {
      accountName: settings.branchName || null,
      bankName: settings.bankName || null,
      bankBranch: settings.bankBranch || null,
      accountNumber: settings.accountNumber || null,
      ifsc: settings.ifsc || null,
      upiId: settings.upiId || null,
    },
    unavailable: false,
  };
}

export async function getBankDetails(): Promise<BankDetailsContent> {
  return toBankDetails(await loadSettingsOrNull());
}

/**
 * The front page, section by section. What the branch has not published stays
 * unseen: the introduction is its own words from Settings, the notices and
 * works are what the database holds, and the finance block is empty until a
 * treasurer closes a year.
 */
export async function getHomepageContent(): Promise<HomepageContent> {
  const [notices, works, finance, settings, photos] = await Promise.all([
    getNotices(),
    getWorks("ongoing"),
    getFinanceSummary(),
    loadSettingsOrNull(),
    getGalleryStrip(),
  ]);
  const contact = toContactDetails(settings);

  return {
    introduction: settings?.missionText.trim() || null,
    notices: notices.state === "ready" ? notices.items : [],
    noticesUnavailable: notices.state === "unavailable",
    projects: works.state === "ready" ? works.items.slice(0, 3) : [],
    projectsUnavailable: works.state === "unavailable",
    finance,
    photos: photos.state === "ready" ? photos.items : [],
    photosUnavailable: photos.state === "unavailable",
    contact: contact.contact,
    contactUnavailable: contact.unavailable,
  };
}

export async function getNotices(kind?: NoticeKind): Promise<PublicRead<PublicNotice>> {
  let published: PublicNotice[];
  try {
    published = await listPublishedNotices(kind);
  } catch (error) {
    console.error("notices are unavailable", error);
    return { state: "unavailable" };
  }
  return published.length > 0 ? { state: "ready", items: published } : { state: "empty" };
}

/** A page of a list, with the arithmetic the page's own navigation reads. */
export type PublicPageRead<T> =
  | { state: "ready"; items: T[]; info: PageInfo }
  | { state: "empty" }
  | { state: "unavailable" };

/**
 * One page of the published notices, newest first.
 *
 * The count is read before the page so that a bookmark set when the board was
 * longer lands on the last page that still exists rather than on a blank screen,
 * and so the navigation can say what it is one page *of*. Two reads rather than
 * one, both on the published index, and cheaper than the alternative of loading
 * the year's notices to show twenty.
 */
export async function getNoticesPage(
  kind: NoticeKind | undefined,
  page: number,
  size: number,
): Promise<PublicPageRead<PublicNotice>> {
  try {
    const total = await countPublishedNotices(kind);
    if (total === 0) return { state: "empty" };
    const info = pageInfo(page, size, total);
    const items = await listPublishedNoticesWithin(kind, (info.page - 1) * size, size);
    return { state: "ready", items, info };
  } catch (error) {
    console.error("notices are unavailable", error);
    return { state: "unavailable" };
  }
}

/**
 * A draft 404s: it is addressed by the same slug, but it is not in the published
 * query, and an unissued notice must not be readable by guessing its address.
 */
export async function getNoticeBySlug(slug: string): Promise<NoticeDetail> {
  let published: PublicNotice | null;
  try {
    published = await getPublishedNoticeBySlug(slug);
  } catch (error) {
    console.error("this notice is unavailable", error);
    return { state: "unavailable" };
  }
  return published ? { state: "ready", notice: published } : { state: "missing" };
}

/**
 * A committee card. `phone` and `email` are already absent when the member has
 * not agreed to be contacted — the check happens while the payload is built, so
 * a number typed for the office cannot reach a browser by a page forgetting to
 * hide it.
 */
export type PublicMember = {
  name: string;
  position: string | null;
  term: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
};

/** One line of the community register: a name, a ward, and any office held. */
export type DirectoryRow = {
  name: string;
  ward: string | null;
  position: string | null;
};

export type CommitteeSection = {
  type: MemberType;
  label: string;
  members: PublicMember[];
};

export type CommitteePage =
  | { state: "ready"; sections: CommitteeSection[]; past: PublicMember[] }
  | { state: "empty" }
  | { state: "unavailable" };

/** The three bodies the approval order names, in the order the site shows them. */
const COMMITTEE_GROUPS: readonly { type: MemberType; label: string }[] = [
  { type: "office_bearer", label: "Office-bearers" },
  { type: "executive_member", label: "Executive members" },
  { type: "advisory_board", label: "Advisory and auditory board" },
];

/**
 * The committee in its three parts, plus those who held office before them. An
 * empty section is dropped rather than shown as a heading over nothing, so a
 * branch that has entered its office-bearers but not its board sees one list,
 * not one list and a gap.
 */
export async function getCommittee(): Promise<CommitteePage> {
  let docs;
  try {
    docs = await listMembers();
  } catch (error) {
    console.error("the committee list is unavailable", error);
    return { state: "unavailable" };
  }

  const current = docs.filter((doc) => doc.current);
  const sections = COMMITTEE_GROUPS.map((group) => ({
    ...group,
    members: current
      .filter((doc) => doc.memberType === group.type)
      .map((doc) => toPublicMember(doc)),
  })).filter((section) => section.members.length > 0);

  const past = docs
    .filter((doc) => !doc.current && doc.memberType !== "community_member")
    .map((doc) => toPublicMember(doc));

  if (sections.length === 0 && past.length === 0) return { state: "empty" };
  return { state: "ready", sections, past };
}

export async function getMemberDirectory(): Promise<PublicRead<DirectoryRow>> {
  try {
    const docs = await listMembers({ memberType: "community_member" });
    return docs.length > 0
      ? { state: "ready", items: docs.map((doc) => toDirectoryRow(doc)) }
      : { state: "empty" };
  } catch (error) {
    console.error("the member register is unavailable", error);
    return { state: "unavailable" };
  }
}

/**
 * The works, in the branch's own order, each carrying the percentage from its
 * latest dated report. An unread database is reported as unavailable rather than
 * as an empty page: "nothing published yet" is a statement about the branch's
 * record, and a timeout does not license us to make it.
 */
export async function getWorks(status?: ProjectStatus): Promise<PublicRead<PublicProject>> {
  let works: PublicProject[];
  try {
    works = await publicProjects(status);
  } catch (error) {
    console.error("works are unavailable", error);
    return { state: "unavailable" };
  }
  return works.length > 0 ? { state: "ready", items: works } : { state: "empty" };
}

/**
 * The gallery as the branch arranged it: albums, each with its pictures in the
 * order they were numbered. Nothing here guesses at a picture — an album with no
 * words about it could not be published in the first place.
 */
export async function getGalleryAlbums(): Promise<PublicRead<GalleryAlbum>> {
  let albums: GalleryAlbum[];
  try {
    albums = await galleryAlbums();
  } catch (error) {
    console.error("the gallery is unavailable", error);
    return { state: "unavailable" };
  }
  return albums.length > 0 ? { state: "ready", items: albums } : { state: "empty" };
}

function toGalleryPhoto(item: PublicGalleryItem): GalleryPhoto {
  return { url: item.imageUrl, thumbUrl: item.thumbUrl, alt: item.alt, caption: item.caption };
}

/** The most recent few pictures, for the strip on the front page. */
export async function getGalleryStrip(limit = 6): Promise<PublicRead<GalleryPhoto>> {
  let items: PublicGalleryItem[];
  try {
    items = await recentGalleryItems(limit);
  } catch (error) {
    console.error("the photo strip is unavailable", error);
    return { state: "unavailable" };
  }
  return items.length > 0
    ? { state: "ready", items: items.map(toGalleryPhoto) }
    : { state: "empty" };
}

export async function getWorkBySlug(slug: string): Promise<WorkDetail> {
  let detail: { project: PublicProject; updates: PublicProjectUpdate[] } | null;
  try {
    detail = await publicProjectBySlug(slug);
  } catch (error) {
    console.error("this work is unavailable", error);
    return { state: "unavailable" };
  }
  if (!detail) return { state: "missing" };
  return { state: "ready", project: detail.project, updates: detail.updates };
}

export async function getContactDetails(): Promise<ContactContent> {
  return toContactDetails(await loadSettingsOrNull());
}

/**
 * The years whose accounts the branch keeps. A locked year is shown as closed
 * rather than hidden: a member reading a year that cannot change is the point of
 * closing it, and a list that skipped it would look as though the year had never
 * been kept at all.
 */
export type FinanceYearOption = {
  label: string;
  startDate: string;
  endDate: string;
  locked: boolean;
};

function toYearOption(doc: FinancialYearDoc): FinanceYearOption {
  return {
    label: doc.label,
    startDate: doc.startDate,
    endDate: doc.endDate,
    locked: yearIsClosed(doc),
  };
}

export async function getFinanceYears(): Promise<PublicRead<FinanceYearOption>> {
  let years: FinancialYearDoc[];
  try {
    years = await listFinancialYears();
  } catch (error) {
    console.error("the published years are unavailable", error);
    return { state: "unavailable" };
  }
  return years.length > 0 ? { state: "ready", items: years.map(toYearOption) } : { state: "empty" };
}

/**
 * The front page's three figures, and whether they could be read at all.
 *
 * `yearsOpened` is kept because the two empty cases ask for different sentences:
 * no year opened is a branch that has not started publishing, while a year
 * opened with nothing in it is one that has started and is still entering
 * vouchers.
 */
export type FinanceSummaryContent = {
  snapshot: FinanceSnapshot | null;
  unavailable: boolean;
  yearsOpened: number;
};

/**
 * The year a visitor is shown as "this year": the one whose dates today falls
 * between, or — when the branch has not opened that year yet — the newest one it
 * has. A year opened ahead of today counts as the newest thing there is, because
 * closing accounts in advance is the treasurer's own business and a page that
 * skipped it would show an older year than the branch keeps.
 */
export function financeYearToOpen(
  years: readonly FinancialYearDoc[],
  today: Date,
): FinancialYearDoc | null {
  const iso = istCalendarDate(today);
  const covering = years.find((year) => iso >= year.startDate && iso <= year.endDate);
  if (covering) return covering;

  return years.reduce<FinancialYearDoc | null>(
    (newest, year) => (!newest || year.startDate > newest.startDate ? year : newest),
    null,
  );
}

function chooseYear(
  years: readonly FinancialYearDoc[],
  label?: string,
): FinancialYearDoc | null {
  if (label === undefined) return financeYearToOpen(years, new Date());
  return years.find((year) => year.label === label) ?? null;
}

/** What the ledger needs from a voucher, and nothing the pages print. */
function toLedgerRow(doc: TransactionDoc): LedgerRow {
  return {
    type: doc.type,
    category: doc.category,
    amountPaise: doc.amountPaise,
    projectId: doc.projectId ?? null,
  };
}

/**
 * The three states, worked out from what the reads returned rather than from
 * what they threw: a year and its vouchers, a year and an unreadable ledger, or
 * no year at all. Exported pure because that is the only way §9's difference
 * between *empty* and *unavailable* can be tested without a database.
 */
export function toFinanceContent(
  year: FinancialYearDoc | null,
  rows: readonly LedgerRow[] | null,
  yearsOpened: number,
): FinanceSummaryContent {
  if (rows === null) return { snapshot: null, unavailable: true, yearsOpened };
  if (!year) return { snapshot: null, unavailable: false, yearsOpened };

  return {
    snapshot: { yearLabel: year.label, ...summarise(year.openingBalancePaise, rows) },
    unavailable: false,
    yearsOpened,
  };
}

/**
 * The summary the front page and `/api/finance/summary` show.
 *
 * Every rupee in it is totalled from the vouchers entered against the year, and
 * nothing is standing in for a figure nobody entered. When the ledger cannot be
 * read the result says so instead of printing a year of zeros, which would be a
 * financial claim the branch has not made (§9).
 */
export async function getFinanceSummary(label?: string): Promise<FinanceSummaryContent> {
  let years: FinancialYearDoc[];
  try {
    years = await listFinancialYears();
  } catch (error) {
    console.error("the branch's figures are unavailable", error);
    return toFinanceContent(null, null, 0);
  }

  const year = chooseYear(years, label);
  if (!year) return toFinanceContent(null, [], years.length);

  let docs: TransactionDoc[];
  try {
    docs = await listTransactions({ yearId: year._id });
  } catch (error) {
    console.error(`the ledger for ${year.label} could not be totalled`, error);
    return toFinanceContent(null, null, years.length);
  }

  return toFinanceContent(year, docs.map(toLedgerRow), years.length);
}

/**
 * One line of the published ledger, in the shape `@/lib/finance-ledger` prints
 * and filters. The direction travels with it, because a rupee figure that does
 * not say whether money came in or went out is half a record — and the reader is
 * the one left to guess which half.
 */
function toPublicLedgerRow(doc: TransactionDoc): PublicLedgerRow {
  return {
    date: doc.date,
    voucherNo: doc.voucherNo,
    description: doc.description,
    party: doc.party,
    type: doc.type,
    category: doc.category,
    categoryLabel: categoryLabel(doc.category),
    amountPaise: doc.amountPaise,
  };
}

/**
 * One year as the public reads it: totals, each side broken into heads, the
 * whole ledger oldest-first with the running balance beside each line, and the
 * audit report when the branch has saved one.
 *
 * `missing` is for a year the branch has not opened — a typed label, a link from
 * a bookmark, a year deleted since — and is the page's own 404. `unavailable` is
 * for a database that would not answer, which §9 insists is not the same claim.
 */
export type FinanceYearDetail =
  | {
      state: "ready";
      year: FinanceYearOption;
      snapshot: FinanceSnapshot;
      income: CategoryTotal[];
      expense: CategoryTotal[];
      ledger: readonly PublicLedgerLine[];
      auditPdfUrl: string | null;
    }
  | { state: "missing" }
  | { state: "unavailable" };

export async function getFinanceYearDetail(label?: string): Promise<FinanceYearDetail> {
  let years: FinancialYearDoc[];
  try {
    years = await listFinancialYears();
  } catch (error) {
    console.error("the published years are unavailable", error);
    return { state: "unavailable" };
  }

  const year = chooseYear(years, label);
  if (!year) return { state: "missing" };

  let docs: TransactionDoc[];
  try {
    docs = await listTransactions({ yearId: year._id });
  } catch (error) {
    console.error(`the ledger for ${year.label} is unavailable`, error);
    return { state: "unavailable" };
  }

  const rows = docs.map(toLedgerRow);
  return {
    state: "ready",
    year: toYearOption(year),
    snapshot: { yearLabel: year.label, ...summarise(year.openingBalancePaise, rows) },
    income: totalsByCategory(rows, "income"),
    expense: totalsByCategory(rows, "expense"),
    ledger: withRunningBalance(
      year.openingBalancePaise,
      docs.map(toPublicLedgerRow),
    ),
    auditPdfUrl: year.auditPdfUrl ?? null,
  };
}

/** What `/about` shows, and which part of the settings each line reads from. */
export type AboutContent = {
  /** The branch's own account of how it began. */
  branchStory: string | null;
  mission: string | null;
  foundedYear: number | null;
  registrationNo: string | null;
  /** True when the settings could not be read at all, so the blanks prove nothing. */
  unavailable: boolean;
};

function textOrNothing(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The settings' fields mapped onto the page's sections. A box nobody has filled
 * stays empty on the page, which then says the branch has not written it yet —
 * the site's makers do not supply a mission statement or a founding story on
 * the office-bearers' behalf.
 */
export function toAboutContent(settings: SettingsValues | null): AboutContent {
  if (!settings) {
    return {
      branchStory: null,
      mission: null,
      foundedYear: null,
      registrationNo: null,
      unavailable: true,
    };
  }
  return {
    branchStory: textOrNothing(settings.aboutText),
    mission: textOrNothing(settings.missionText),
    foundedYear: settings.branchFoundedYear,
    registrationNo: textOrNothing(settings.registrationNo),
    unavailable: false,
  };
}

export async function getAboutContent(): Promise<AboutContent> {
  return toAboutContent(await loadSettingsOrNull());
}

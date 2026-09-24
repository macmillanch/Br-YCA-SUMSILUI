/**
 * Public view-models for the site's content, plus the source that feeds them.
 *
 * Plans 2 and 3 replace `getHomepageContent`'s body with MongoDB reads. The
 * return types are what the page components bind to, so those components do
 * not change when the data starts coming from the database.
 */

import { getSettings, type SettingsValues } from "@/lib/settings";
import { fiscalYearFromLabel } from "@/lib/fiscal-year";
import { listMembers, toDirectoryRow, toPublicMember } from "@/lib/members";
import { getPublishedNoticeBySlug, listPublishedNotices } from "@/lib/notices";
import { publicProjectBySlug, publicProjects } from "@/lib/projects";
import type { MemberType, NoticeKind, ProjectStatus } from "@/lib/types";

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
 * One work, as the site shows it. There is deliberately no spend figure here:
 * what has been drawn against a work comes out of the ledger in Plan 3, and a
 * card that had room for a typed amount would be a card where an invented one
 * could live. The percentage is the branch's own latest dated report, and null
 * until such a report exists — which the card renders as "not reported yet",
 * never as 0%.
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

export type GalleryPhoto = {
  url: string;
  alt: string;
  width: number;
  height: number;
};

export type ContactDetails = {
  addressLines: readonly string[];
  phone: string | null;
  email: string | null;
  officeHours: string | null;
  mapUrl: string | null;
};

export type HomepageContent = {
  introduction: string;
  notices: readonly PublicNotice[];
  /** True when the notices could not be read at all — not merely none yet. */
  noticesUnavailable: boolean;
  /** The works the branch has under way, read from the database like the notices. */
  projects: readonly PublicProject[];
  projectsUnavailable: boolean;
  finance: FinanceSnapshot | null;
  photos: readonly GalleryPhoto[];
  contact: ContactDetails;
  /**
   * True while the branch has supplied no real introduction and no real
   * accounts. Every section renders a DEMO marker from this flag, and it still
   * covers the finance block until Plan 3 fills it — demo figures can never
   * quietly become a public record.
   */
  isSample: boolean;
};

export { KIND_LABEL, MEMBER_TYPE_LABEL, STATUS_LABEL } from "@/lib/labels";

const SAMPLE_NOTICES: readonly PublicNotice[] = [
  {
    slug: "sample-annual-general-meeting",
    kind: "notice",
    title: "Annual General Meeting — members are requested to attend",
    publishedOn: "2026-09-10",
    eventDate: "2026-10-02",
    venue: "Branch office, Sumsilui",
    excerpt:
      "The branch office-bearers will present the year's accounts and the works carried out during the year.",
    body: "All members of the branch are requested to attend the Annual General Meeting.\n\nThe office-bearers will present the accounts for the year, the works carried out, and the programme for the coming year. Members who wish to raise a matter may send it to the Secretary in writing before the meeting.\n\nRefreshments will be arranged for those attending.",
    translations: [],
    attachments: [],
  },
  {
    slug: "sample-blood-donation-camp",
    kind: "announcement",
    title: "Volunteers needed for the blood donation camp",
    publishedOn: "2026-08-28",
    eventDate: "2026-09-20",
    venue: "Branch office, Sumsilui",
    excerpt:
      "Registration at the branch office. Bring an identity card. Donors above 60 are advised to consult a doctor first.",
    body: "The branch is organising a blood donation camp with the help of the local blood bank.\n\nVolunteers are needed to register donors, guide donors through the camp, and stay afterwards to help with refreshments. Anyone able to give part of the day is welcome.\n\nDonors should eat before attending and carry an identity card. Donors above sixty are advised to consult their doctor first.",
    translations: [],
    attachments: [],
  },
  {
    slug: "sample-student-scholarship",
    kind: "notice",
    title: "Applications open for the branch student assistance scheme",
    publishedOn: "2026-08-14",
    eventDate: "2026-09-05",
    venue: null,
    excerpt:
      "Students of classes IX, XI and the first year of graduation may apply with a marks card and income certificate.",
    body: "Applications are invited from students of the community for the branch assistance scheme.\n\nStudents of class IX, class XI and the first year of graduation may apply. A recent marks card, a residence certificate, and an income certificate of the guardian are required.\n\nApplications are received at the branch office. The selection committee meets after the last date and the list of assistance is published afterwards.",
    translations: [],
    attachments: [],
  },
  {
    slug: "sample-press-road-repair",
    kind: "press_release",
    title: "Association submits memorandum on the repair of the approach road",
    publishedOn: "2026-07-30",
    venue: null,
    excerpt:
      "A delegation met the local member and handed over a memorandum signed by residents of the locality.",
    body: "A delegation of the branch office-bearers met the local member and handed over a memorandum on the condition of the approach road.\n\nThe memorandum records that a stretch of the road has remained unrepaired through two monsoons, that school vehicles cannot use it in heavy rain, and that residents have collected signatures in support.\n\nThe association requests a written reply and a target date for the repair.",
    translations: [],
    attachments: [],
  },
];

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

/**
 * A settings read that fails must not take the page down with it — the footer
 * already says the details are unavailable, so the section falls back to blank.
 */
async function loadContact(): Promise<ContactDetails> {
  try {
    return contactFromSettings(await getSettings());
  } catch (error) {
    console.error("contact details unavailable", error);
    return CONTACT_PLACEHOLDER;
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

/**
 * The donate page promises these came from the Treasurer and not from the
 * template, so every field starts null and only a saved value can fill it.
 */
export async function getBankDetails(): Promise<BankDetails> {
  try {
    const settings = await getSettings();
    return {
      accountName: settings.branchName || null,
      bankName: settings.bankName || null,
      bankBranch: settings.bankBranch || null,
      accountNumber: settings.accountNumber || null,
      ifsc: settings.ifsc || null,
      upiId: settings.upiId || null,
    };
  } catch (error) {
    console.error("bank details unavailable", error);
    return BLANK_BANK;
  }
}

/**
 * The parts of the homepage the branch has not supplied yet: the introduction
 * and the finance block. Works and notices come from the database, so nothing
 * here can reach a visitor as a record of what the branch has done.
 */
const SAMPLE_CONTENT: Omit<HomepageContent, "projects" | "projectsUnavailable"> = {
  introduction:
    "Young Chakma Association, Sumsilui Branch serves the Chakma community of Sumsilui in Mizoram. The branch carries out social work, keeps its accounts open for members to read, and publishes its notices here.",
  notices: SAMPLE_NOTICES,
  noticesUnavailable: false,
  finance: {
    yearLabel: "2026-27",
    openingPaise: 18500000,
    incomePaise: 46200000,
    expensePaise: 31450000,
    closingPaise: 33250000,
  },
  photos: [],
  contact: CONTACT_PLACEHOLDER,
  isSample: true,
};

export async function getHomepageContent(): Promise<HomepageContent> {
  const notices = await getNotices();
  const works = await getWorks("ongoing");
  return {
    ...SAMPLE_CONTENT,
    notices: notices.state === "ready" ? notices.items : [],
    noticesUnavailable: notices.state === "unavailable",
    projects: works.state === "ready" ? works.items.slice(0, 3) : [],
    projectsUnavailable: works.state === "unavailable",
    contact: await loadContact(),
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
  if (published.length > 0) return { state: "ready", items: published };

  // Nothing published yet, so the standing-in notices keep the layout reviewable.
  // They are marked DEMO wherever they render, and Task 6 deletes them.
  const samples = SAMPLE_NOTICES.filter((notice) => !kind || notice.kind === kind);
  return samples.length > 0 ? { state: "ready", items: samples } : { state: "empty" };
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
  if (published) return { state: "ready", notice: published };

  // Only the standing-in notices, whose addresses are fixed, keep resolving.
  // A real slug that is not in the database is a genuine 404.
  const sample = SAMPLE_NOTICES.find((notice) => notice.slug === slug);
  return sample ? { state: "ready", notice: sample } : { state: "missing" };
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

export async function getContactDetails(): Promise<ContactDetails> {
  return loadContact();
}

export type FinanceYearOption = { label: string; startDate: string; endDate: string };

export async function getFinanceYears(): Promise<readonly FinanceYearOption[]> {
  const finance = SAMPLE_CONTENT.finance;
  if (!finance) return [];
  const year = fiscalYearFromLabel(finance.yearLabel);
  return [{ label: year.label, startDate: year.startDate, endDate: year.endDate }];
}

/**
 * Public view-models for the site's content, plus the source that feeds them.
 *
 * Plans 2 and 3 replace `getHomepageContent`'s body with MongoDB reads. The
 * return types are what the page components bind to, so those components do
 * not change when the data starts coming from the database.
 */

import { fiscalYearFromLabel } from "@/lib/fiscal-year";

export type NoticeKind = "notice" | "press_release" | "announcement";
export type PublicNotice = {
  slug: string;
  kind: NoticeKind;
  title: string;
  publishedOn: string;
  eventDate?: string;
  venue: string | null;
  excerpt: string;
  body: string;
  hasChakma: boolean;
  hasBangla: boolean;
};

export type ProjectStatus = "ongoing" | "proposed" | "completed" | "deferred";

export type PublicProject = {
  slug: string;
  title: string;
  description: string;
  location: string;
  status: ProjectStatus;
  sanctionedPaise: number;
  /** Always summed from the transaction ledger. */
  spentPaise: number;
};

/**
 * Progress is derived, never stored. Spending a third of the sanctioned amount
 * is a third of the bar whatever the record says elsewhere.
 */
export function progressPercentOf(
  project: Pick<PublicProject, "sanctionedPaise" | "spentPaise" | "status">,
): number {
  if (project.status === "completed") return 100;
  if (project.sanctionedPaise <= 0) return 0;
  const ratio = project.spentPaise / project.sanctionedPaise;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

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
  projects: readonly PublicProject[];
  finance: FinanceSnapshot | null;
  photos: readonly GalleryPhoto[];
  contact: ContactDetails;
  /**
   * True while the branch has supplied no real records. Every section renders a
   * DEMO marker from this flag, and it flips to false by itself once the admin
   * publishes a notice — demo text can never quietly become a public record.
   */
  isSample: boolean;
};

export const KIND_LABEL: Record<NoticeKind, string> = {
  notice: "Notice",
  press_release: "Press release",
  announcement: "Announcement",
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  ongoing: "Ongoing",
  proposed: "Proposed",
  completed: "Completed",
  deferred: "Deferred",
};

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
    hasChakma: false,
    hasBangla: false,
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
    hasChakma: false,
    hasBangla: false,
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
    hasChakma: false,
    hasBangla: false,
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
    hasChakma: false,
    hasBangla: false,
  },
];

const SAMPLE_PROJECTS: readonly PublicProject[] = [
  {
    slug: "sample-community-water-tank",
    title: "Overhead water tank for the upper lines",
    description:
      "Storage tank and stand-pipe so that households on the higher ground are not dependent on the morning supply alone.",
    location: "Sumsilui, upper locality",
    status: "ongoing",
    sanctionedPaise: 25000000,
    spentPaise: 9750000,
  },
  {
    slug: "sample-student-reading-room",
    title: "Student reading room and study light",
    description:
      "A quiet room with seating for twenty students, a reading lamp at each place, and a shelf of reference books.",
    location: "Branch office premises",
    status: "proposed",
    sanctionedPaise: 8000000,
    spentPaise: 0,
  },
  {
    slug: "sample-drain-repair",
    title: "Repair of the roadside drain below the church",
    description:
      "Nine metres of collapsed drain rebuilt with new slabs, so that stagnant water does not collect before the monsoon.",
    location: "Sumsilui, below the church",
    status: "completed",
    sanctionedPaise: 4500000,
    spentPaise: 4410000,
  },
];

export const CONTACT_PLACEHOLDER: ContactDetails = {
  addressLines: ["Sumsilui Branch", "Mizoram — PIN code to be confirmed"],
  phone: null,
  email: null,
  officeHours: null,
  mapUrl: null,
};

/**
 * Placeholder layout content. Contact details deliberately stay null so an
 * invented phone number or address can never reach a visitor.
 */
const SAMPLE_CONTENT: HomepageContent = {
  introduction:
    "Young Chakma Association, Sumsilui Branch serves the Chakma community of Sumsilui in Mizoram. The branch carries out social work, keeps its accounts open for members to read, and publishes its notices here.",
  notices: SAMPLE_NOTICES,
  projects: SAMPLE_PROJECTS,
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
  return SAMPLE_CONTENT;
}

export async function getNotices(kind?: NoticeKind): Promise<readonly PublicNotice[]> {
  const all = SAMPLE_CONTENT.notices;
  return kind ? all.filter((notice) => notice.kind === kind) : all;
}

export async function getNoticeBySlug(slug: string): Promise<PublicNotice | null> {
  return SAMPLE_CONTENT.notices.find((notice) => notice.slug === slug) ?? null;
}

export async function getProjects(status?: ProjectStatus): Promise<readonly PublicProject[]> {
  const all = SAMPLE_CONTENT.projects;
  return status ? all.filter((project) => project.status === status) : all;
}

export async function getProjectBySlug(slug: string): Promise<PublicProject | null> {
  return SAMPLE_CONTENT.projects.find((project) => project.slug === slug) ?? null;
}

export async function getContactDetails(): Promise<ContactDetails> {
  return SAMPLE_CONTENT.contact;
}

export type FinanceYearOption = { label: string; startDate: string; endDate: string };

export async function getFinanceYears(): Promise<readonly FinanceYearOption[]> {
  const finance = SAMPLE_CONTENT.finance;
  if (!finance) return [];
  const year = fiscalYearFromLabel(finance.yearLabel);
  return [{ label: year.label, startDate: year.startDate, endDate: year.endDate }];
}

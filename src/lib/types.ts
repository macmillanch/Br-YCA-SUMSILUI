import type { ObjectId } from "mongodb";

/**
 * Document shapes are type aliases, never interfaces. The driver constrains its
 * schema generic to `Document`, an index-signature type, and TypeScript only
 * gives an implicit index signature to object-literal types — an interface
 * fails that constraint and forces a cast at every call site.
 */

export const ROLES = ["super_admin", "editor", "treasurer"] as const;
export type Role = (typeof ROLES)[number];

export type UserDoc = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: Role;
  active: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
};

export type SessionDoc = {
  _id: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
};

export type LoginAttemptDoc = {
  _id: ObjectId;
  key: string;
  count: number;
  firstAt: Date;
  expiresAt: Date;
};

export type SettingsDoc = {
  _id: ObjectId;
  key: "site";
  branchName: string;
  registrationNo: string;
  branchFoundedYear: number | null;
  addressLine: string;
  district: string;
  state: string;
  phone: string;
  email: string;
  facebookUrl: string;
  whatsappNumber: string;
  aboutText: string;
  missionText: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  footerNote: string;
  updatedAt: Date;
  updatedById: ObjectId | null;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
};

export type AuthContext = {
  user: UserDoc;
  sessionId: ObjectId;
};

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super admin",
  editor: "Editor",
  treasurer: "Treasurer",
};

/* ------------------------------------------------------------------ content */

/**
 * Dates that a human reads as a calendar day — event dates, start dates — are
 * stored as `YYYY-MM-DD` strings, never as `Date`. A `Date` is an instant, and
 * an instant stored from IST reads back as the previous day in UTC. Timestamps
 * that only the machine compares (`createdAt`) stay `Date`.
 */

export const NOTICE_KINDS = ["notice", "press_release", "announcement"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];
export type NoticeStatus = "draft" | "published";

export type NoticeAttachment = { name: string; url: string; mimeType: string; size: number };

export type NoticeDoc = {
  _id: ObjectId;
  slug: string;
  kind: NoticeKind;
  status: NoticeStatus;
  titleEn: string;
  bodyEn: string;
  /**
   * Bengali and Chakma (Chakma script) versions are optional. The public
   * language toggle only offers the languages that actually have text, so a
   * notice never presents an empty panel.
   */
  titleBn?: string;
  bodyBn?: string;
  titleCdp?: string;
  bodyCdp?: string;
  publishedAt: Date | null;
  eventDate?: string;
  venue?: string;
  attachments: NoticeAttachment[];
  authorId: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export const MEMBER_TYPES = ["office_bearer", "community_member"] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

export type MemberDoc = {
  _id: ObjectId;
  name: string;
  memberType: MemberType;
  /** Free text — President, General Secretary, Executive Member… */
  position?: string;
  /** e.g. `2026-2028`. */
  term?: string;
  photoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  ward?: string;
  order: number;
  /** False moves the person to "Past office-bearers". */
  current: boolean;
  /**
   * Off by default, and enforced where the payload is built rather than in the
   * UI: a number typed for the office-bearers' own use must not reach the
   * public page because someone forgot a checkbox in a form.
   */
  showContactPublicly: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const PROJECT_STATUSES = ["proposed", "ongoing", "completed", "deferred"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectDoc = {
  _id: ObjectId;
  slug: string;
  title: string;
  description: string;
  status: ProjectStatus;
  startDate?: string;
  targetDate?: string;
  completedDate?: string;
  sanctionedAmountPaise: number;
  beneficiaries: number;
  location?: string;
  coverImageUrl?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectUpdateDoc = {
  _id: ObjectId;
  projectId: ObjectId;
  date: string;
  text: string;
  photos: string[];
  percentComplete: number;
  createdAt: Date;
};

export type GalleryItemDoc = {
  _id: ObjectId;
  album: string;
  caption: string;
  /** Required: the grid is read aloud, and a photo of a meeting says nothing. */
  alt: string;
  imageUrl: string;
  thumbUrl: string;
  takenAt?: string;
  eventId: ObjectId | null;
  order: number;
  uploadedById: ObjectId | null;
  createdAt: Date;
};

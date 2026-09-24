import type { MemberType, NoticeKind, ProjectStatus } from "@/lib/types";

/**
 * Labels sit in their own module because a client component needs them and
 * `src/lib/content.ts` reaches MongoDB — importing the words from there would
 * pull the database driver into the browser bundle.
 */

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

/** The admin form's wording. The public page uses its own section headings. */
export const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  office_bearer: "Office-bearer",
  executive_member: "Executive member",
  advisory_board: "Advisory and auditory board",
  community_member: "Community member",
};

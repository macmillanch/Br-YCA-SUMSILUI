import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";
import { SLUG_MAX_LENGTH, isSlug, slugFromTitle } from "@/lib/slug";

/**
 * Shared by the API handlers and, through `NOTICE_SCHEMA`, by anything that
 * writes a notice. The browser's own copy of these rules would drift from the
 * server's within a week, so the form shows what the server says.
 */

const text = (max: number) => z.string().trim().max(max);

/** Empty means "no translation" — a half-filled language is refused below. */
const PAIR_FIELDS = [
  ["titleBn", "bodyBn", "Bangla"],
  ["titleCdp", "bodyCdp", "Chakma"],
] as const;

export const NOTICE_KIND_SCHEMA = z.enum(["notice", "press_release", "announcement"]);
export const NOTICE_STATUS_SCHEMA = z.enum(["draft", "published"]);

export const NOTICE_SCHEMA = z
  .object({
    kind: NOTICE_KIND_SCHEMA,
    status: NOTICE_STATUS_SCHEMA,
    titleEn: z
      .string()
      .trim()
      .min(3, "Give the notice a title")
      .max(160, "Keep the title under 160 characters"),
    bodyEn: z.string().trim().min(1, "The notice needs some text").max(20000),
    /** Empty is allowed: the web address is then derived from the title. */
    slug: text(SLUG_MAX_LENGTH).toLowerCase(),
    eventDate: z
      .string()
      .trim()
      .max(10)
      .refine((value) => value === "" || isCalendarDate(value), {
        message: "Use the form 2026-09-24, or leave it empty",
      }),
    venue: text(200),
    titleBn: text(160),
    bodyBn: text(20000),
    titleCdp: text(160),
    bodyCdp: text(20000),
  })
  .superRefine((value, issues) => {
    const slug = value.slug === "" ? slugFromTitle(value.titleEn) : value.slug;
    if (!isSlug(slug)) {
      issues.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message:
          value.slug === ""
            ? "Type a web address — the title has no letters we can use in one"
            : "Use lowercase letters, numbers and single hyphens",
      });
    }
    for (const [titleField, bodyField, label] of PAIR_FIELDS) {
      const hasTitle = value[titleField] !== "";
      const hasBody = value[bodyField] !== "";
      if (hasTitle !== hasBody) {
        issues.addIssue({
          code: z.ZodIssueCode.custom,
          path: [hasBody ? titleField : bodyField],
          message:
            hasTitle
              ? `Add the ${label} text as well, or remove the ${label} title`
              : `Add the ${label} title as well, or remove the ${label} text`,
        });
      }
    }
  });

export type NoticeInput = z.infer<typeof NOTICE_SCHEMA>;

/** The address the notice will live at, deriving it from the title when blank. */
export function effectiveSlug(value: NoticeInput): string {
  return value.slug === "" ? slugFromTitle(value.titleEn) : value.slug;
}

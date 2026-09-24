import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";
import { PROJECT_STATUSES } from "@/lib/types";
import { SLUG_MAX_LENGTH, isSlug, slugFromTitle } from "@/lib/slug";

/**
 * A work is the one record a visitor reads as a promise: what was sanctioned for
 * it, and how far the branch says it has got. So the money is a whole number of
 * paise rather than a float, the dates have to be real calendar days, and a
 * progress report has to say what percentage it is claiming.
 */

const text = (max: number) => z.string().trim().max(max);

/** Blank means "not recorded", which the page renders as no date, never as a guess. */
function optionalDate(when: string) {
  return z
    .string()
    .trim()
    .max(10)
    .refine((value) => value === "" || isCalendarDate(value), {
      message: `Use the form 2026-09-24 for the ${when} date, or leave it empty`,
    });
}

export const PROJECT_STATUS_SCHEMA = z.enum(PROJECT_STATUSES);

export const PROJECT_SCHEMA = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Give the work a name")
      .max(160, "Keep the name under 160 characters"),
    /** Empty is allowed: the web address is then derived from the name. */
    slug: text(SLUG_MAX_LENGTH).toLowerCase(),
    description: z
      .string()
      .trim()
      .min(1, "Say what the work is for")
      .max(4000, "Keep the description under 4000 characters"),
    status: PROJECT_STATUS_SCHEMA,
    startDate: optionalDate("start"),
    targetDate: optionalDate("target"),
    completedDate: optionalDate("completion"),
    /** Whole paise, as everywhere in this database: ₹2,50,000 is 25000000. */
    sanctionedAmountPaise: z.coerce
      .number()
      .int("Use whole rupees, or add paise as a decimal")
      .min(0, "A sanctioned amount cannot be negative")
      .max(1_000_000_000_00),
    beneficiaries: z.coerce
      .number()
      .int("Count people, not fractions")
      .min(0, "A number of beneficiaries cannot be negative")
      .max(1_000_000),
    location: text(200),
    coverImageUrl: z.union([
      z.literal(""),
      z.string().trim().url("Add the photograph through the upload screen"),
    ]),
    order: z.coerce.number().int("Use a whole number").min(0).max(9999),
  })
  .superRefine((value, issues) => {
    const slug = value.slug === "" ? slugFromTitle(value.title) : value.slug;
    if (!isSlug(slug)) {
      issues.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message:
          value.slug === ""
            ? "Type a web address — the name has no letters we can use in one"
            : "Use lowercase letters, numbers and single hyphens",
      });
    }
  });

export type ProjectInput = z.infer<typeof PROJECT_SCHEMA>;

/** The address the work will live at, deriving it from the name when blank. */
export function effectiveProjectSlug(value: ProjectInput): string {
  return value.slug === "" ? slugFromTitle(value.title) : value.slug;
}

/**
 * One dated line on the progress timeline. The percentage is what the branch
 * reports from the site, and it is the only thing a bar on the public page is
 * allowed to show — spending is summed from the ledger, not typed here.
 */
export const PROJECT_UPDATE_SCHEMA = z.object({
  date: z
    .string()
    .trim()
    .max(10)
    .refine((value) => isCalendarDate(value), {
      message: "Add the date of the report, in the form 2026-09-24",
    }),
  text: z
    .string()
    .trim()
    .min(1, "Say what has been done")
    .max(4000, "Keep the report under 4000 characters"),
  percentComplete: z.coerce
    .number()
    .int("Use a whole percentage")
    .min(0, "Progress cannot be below zero")
    .max(100, "Progress cannot be above 100"),
  photos: z
    .array(z.string().trim().url("Add photographs through the upload screen"))
    .max(12, "Twelve photographs is enough for one report")
    .default([]),
});

export type ProjectUpdateInput = z.infer<typeof PROJECT_UPDATE_SCHEMA>;

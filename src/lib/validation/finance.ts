import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  categoryLabel,
  isValidCategory,
} from "@/lib/finance-categories";
import { fiscalYearFromLabel } from "@/lib/fiscal-year";
import { TRANSACTION_TYPES, type TransactionCategory } from "@/lib/types";

/**
 * The year the branch keeps its books by, and the two things a treasurer may
 * say about it: what it opened with, and whether it is shut.
 *
 * Only the label is typed. The dates come from it through `fiscalYearFromLabel`,
 * because a year whose window was entered by hand could be made to say anything,
 * and every voucher later sorts itself into that window.
 */

/** `2026-27` — and nothing else that looks like a year. */
export function isFiscalLabel(label: string): boolean {
  try {
    fiscalYearFromLabel(label);
    return true;
  } catch {
    return false;
  }
}

/**
 * An audited report is a document at an address, never a document typed into a
 * field — so https only, and the same rule for the year's own record and for the
 * report attached after it closes.
 */
const httpsReport = z
  .string()
  .trim()
  .url("Add the report through the upload screen, or leave it empty")
  .refine((value) => value.startsWith("https://"), {
    message: "The report address has to start with https://",
  });

export const FINANCIAL_YEAR_SCHEMA = z.object({
  label: z
    .string()
    .trim()
    .max(7, "A financial year is written like 2026-27")
    .refine(isFiscalLabel, {
      message: "Write the year as it runs, 1 April to 31 March — like 2026-27",
    }),
  /**
   * The figure last year closed with, as the audit left it. Zero is allowed and
   * means the branch started from nothing; a negative would mean the site
   * publishes a debt the treasurer has not explained, so it is not a mistake
   * worth accepting quietly.
   */
  openingBalancePaise: z.coerce
    .number()
    .int("Use whole rupees, or add paise as a decimal")
    .min(0, "An opening balance cannot be below zero")
    .max(1_000_000_000_00, "That opening balance is larger than any branch account here holds"),
  auditPdfUrl: z.union([z.literal(""), httpsReport]),
});

export type FinancialYearInput = z.infer<typeof FINANCIAL_YEAR_SCHEMA>;

/**
 * The audited report, attached after the year closes. The treasurer is the one
 * who publishes it, so an empty field means "there is none yet" and the page
 * says so rather than printing a dead link.
 */
export const YEAR_AUDIT_SCHEMA = z.object({
  auditPdfUrl: z.union([z.literal(""), httpsReport]),
});

export type YearAuditInput = z.infer<typeof YEAR_AUDIT_SCHEMA>;

/**
 * Reopening a closed year is the one action on the ledger that a reader of the
 * published accounts cannot see for themselves, so the reason is required, kept
 * on the year, and shown to whoever looks next (§8).
 */
export const UNLOCK_REASON_SCHEMA = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Say in a sentence why the year is being reopened")
    .max(500, "Keep the reason under 500 characters"),
});

export type UnlockReasonInput = z.infer<typeof UNLOCK_REASON_SCHEMA>;

/* ---------------------------------------------------------------- vouchers */

/**
 * What a treasurer types into the book: one voucher, one day, one direction,
 * one head, and the party it was paid to or received from.
 *
 * The year is not a field here. It is a fact about the date, and `finance.ts`
 * works it out — a browser that could name the year it wanted could file an
 * expense in a closed year or move a published total after the fact.
 */

/**
 * Zod 3 takes a custom message for an enum only as an error map, so the words a
 * member of the branch would use are written once and handed to each `z.enum`.
 */
function refuseWith(message: string) {
  return { errorMap: () => ({ message }) };
}

/**
 * Both lists in one enum. `z.enum` needs a tuple it can prove is non-empty;
 * a spread of two fixed lists is exactly that, but the type system cannot see
 * the splice, so the proof is written out here once.
 */
const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] as [
  TransactionCategory,
  ...TransactionCategory[],
];

/** A work's id, or nothing at all — the choice comes from the works list, never from typing. */
const workId = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .regex(/^[0-9a-f]{24}$/, "Choose the work from the list, or leave it empty"),
]);

const TRANSACTION_BASE = z.object({
  date: z
    .string()
    .trim()
    .min(1, "Enter the day the money moved")
    .refine(isCalendarDate, { message: "Write the day as 2026-09-24" }),
  type: z.enum(TRANSACTION_TYPES, refuseWith("Say whether money came in or went out")),
  category: z.enum(ALL_CATEGORIES, refuseWith("Choose one of the heads the accounts are kept under")),
  description: z
    .string()
    .trim()
    .min(3, "Say what the entry was for")
    .max(500, "Keep the description under 500 characters"),
  /** Always positive: the direction is `type`'s job, so a total cannot be inflated by a double negative. */
  amountPaise: z.coerce
    .number()
    .int("Use whole rupees, or add paise as a decimal")
    .min(1, "A voucher for nothing records nothing")
    .max(1_000_000_000_00, "That amount is larger than any voucher here holds"),
  voucherNo: z
    .string()
    .trim()
    .min(2, "Enter the voucher number the paper has on it")
    .max(40, "Keep the voucher number under 40 characters"),
  party: z
    .string()
    .trim()
    .min(2, "Say who the money came from or went to")
    .max(200, "Keep the party under 200 characters"),
  projectId: workId,
});

/**
 * `event` is a head money goes out under and `donation` one it comes in under,
 * and both are real categories — so no list check catches the pair being wrong.
 * Only this does, and it is the mistake that would move money between two
 * published totals without changing either voucher.
 */
function headMatchesType(
  value: { type: (typeof TRANSACTION_TYPES)[number]; category: TransactionCategory },
  ctx: z.RefinementCtx,
): void {
  if (isValidCategory(value.type, value.category)) return;

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["category"],
    message:
      value.type === "income"
        ? `${categoryLabel(value.category)} is a head money goes out under. Income comes in under heads such as Membership subscription, Donations and Grants.`
        : `${categoryLabel(value.category)} is a head money comes in under. Expenditure goes out under heads such as Events, Maintenance and Relief.`,
  });
}

export const TRANSACTION_SCHEMA = TRANSACTION_BASE.superRefine(headMatchesType);

export type TransactionInput = z.infer<typeof TRANSACTION_SCHEMA>;

/**
 * Changing a figure that a member may already have read needs a sentence
 * saying why (§6): a ledger that can be quietly edited is not a transparent
 * one. The reason is stored beside the old and new values, not instead of them.
 */
export const TRANSACTION_EDIT_SCHEMA = TRANSACTION_BASE.extend({
  reason: z
    .string({ required_error: "Say in a sentence why the entry is being changed" })
    .trim()
    .min(10, "Say in a sentence why the entry is being changed")
    .max(500, "Keep the reason under 500 characters"),
}).superRefine(headMatchesType);

export type TransactionEditInput = z.infer<typeof TRANSACTION_EDIT_SCHEMA>;

/**
 * The filters a ledger can be asked for. Every value arrives as a string from a
 * query, and an id that is not an id is a mistake in the link rather than
 * something to look up, so it is refused here instead of reaching the driver.
 */
const idParam = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{24}$/, "That year or work is not one the books know");

export const LEDGER_QUERY_SCHEMA = z.object({
  year: idParam.optional(),
  project: idParam.optional(),
  type: z.enum(TRANSACTION_TYPES, refuseWith("Say whether money came in or went out")).optional(),
  category: z
    .enum(ALL_CATEGORIES, refuseWith("Choose one of the heads the accounts are kept under"))
    .optional(),
  q: z.string().trim().max(100, "Search the ledger with fewer characters").optional(),
});

export type LedgerQueryInput = z.infer<typeof LEDGER_QUERY_SCHEMA>;

/**
 * The year's totals are asked for by name rather than by id, because a link a
 * member can read is half the point of publishing a figure. `year` absent means
 * the year a visitor would call this one, which only the server can work out.
 */
export const SUMMARY_QUERY_SCHEMA = z.object({
  year: z
    .string()
    .trim()
    .max(7, "A financial year is written like 2026-27")
    .refine(isFiscalLabel, {
      message: "Write the year as it runs, 1 April to 31 March — like 2026-27",
    })
    .optional(),
});

export type SummaryQueryInput = z.infer<typeof SUMMARY_QUERY_SCHEMA>;

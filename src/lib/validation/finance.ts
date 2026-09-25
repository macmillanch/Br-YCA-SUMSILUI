import { z } from "zod";
import { fiscalYearFromLabel } from "@/lib/fiscal-year";

/**
 * The year the branch keeps its books by, and the two things a treasurer may
 * say about it: what it opened with, and whether it is shut.
 *
 * Only the label is typed. The dates come from it through `fiscalYearFromLabel`,
 * because a year whose window was entered by hand could be made to say anything,
 * and every voucher later sorts itself into that window.
 */

/** `2026-27` — and nothing else that looks like a year. */
function isFiscalLabel(label: string): boolean {
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

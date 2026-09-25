import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";

/**
 * A contribution, in the branch's own words.
 *
 * A donation is not a second way to write a voucher — it is the same entry seen
 * from the side of the person who gave. So the fields a voucher needs are
 * exactly as strict here as they are in `finance.ts`: the figure is whole paise,
 * the day is a real calendar day, and the paper reference is the one the receipt
 * carries, because an auditor checks the two against each other.
 */
export const DONATION_SCHEMA = z.object({
  date: z
    .string()
    .trim()
    .min(1, "Enter the day the contribution came in")
    .refine(isCalendarDate, { message: "Write the day as 2026-09-24" }),
  donorName: z
    .string()
    .trim()
    .min(2, "Say who the contribution came from")
    .max(200, "Keep the name under 200 characters"),
  purpose: z
    .string()
    .trim()
    .min(3, "Say what it was given for")
    .max(500, "Keep the purpose under 500 characters"),
  amountPaise: z.coerce
    .number()
    .int("Use whole rupees, or add paise as a decimal")
    .min(1, "A contribution of nothing records nothing")
    .max(1_000_000_000_00, "That amount is larger than any voucher here holds"),
  voucherNo: z
    .string()
    .trim()
    .min(2, "Enter the voucher number the paper has on it")
    .max(40, "Keep the voucher number under 40 characters"),
  /**
   * The donor's own answer, not the branch's. Absent means no: a name on the
   * public list is a name published without the person present to object, so
   * silence is not consent.
   */
  acknowledgePublicly: z.boolean().optional().default(false),
});

export type DonationInput = z.infer<typeof DONATION_SCHEMA>;

/**
 * A contribution the public may have read a name against cannot be edited in
 * the dark: the same sentence the ledger asks for is required here, and it is
 * stored on the voucher beside the old and new figures (§6).
 */
export const DONATION_EDIT_SCHEMA = DONATION_SCHEMA.extend({
  reason: z
    .string({ required_error: "Say in a sentence why the contribution is being changed" })
    .trim()
    .min(10, "Say in a sentence why the contribution is being changed")
    .max(500, "Keep the reason under 500 characters"),
});

export type DonationEditInput = z.infer<typeof DONATION_EDIT_SCHEMA>;

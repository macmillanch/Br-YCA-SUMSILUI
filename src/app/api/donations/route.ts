import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import {
  adminDonationsPage,
  saveDonation,
  toAdminDonation,
  type DonationRefusal,
} from "@/lib/donations";
import { MANAGE_FINANCE, lockedYearMessage } from "@/lib/finance";
import { invalidateFinance } from "@/lib/invalidate";
import { DONATION_SCHEMA } from "@/lib/validation/donations";

/**
 * Contributions the office has recorded.
 *
 * Reading this list is the treasurer's own work: it holds the names of donors
 * who asked that they not be printed, so nothing here goes to an editor, and the
 * public page is served by `/donate` reading the database with
 * `DONATION_VISIBILITY_FILTER` on the query instead.
 */

async function refusalFor(refusal: DonationRefusal): Promise<Response> {
  switch (refusal.result) {
    case "no_year_for_date":
      return fail(
        400,
        "no_year_for_date",
        `No accounts are kept for ${refusal.date}. Open the financial year ${refusal.fiscalLabel} first, or enter the contribution against a day inside a year the branch keeps.`,
      );
    case "locked":
      return fail(409, "year_locked", await lockedYearMessage(refusal.year));
    case "not_kept":
      return fail(
        500,
        "not_kept",
        "The contribution was not kept, and neither was the ledger line beside it. Please try again, and tell the office if it fails a second time.",
      );
    case "not_found":
      return fail(404, "not_found", "No such contribution.");
  }
}

export async function GET(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_FINANCE, async () => {
      const page = await adminDonationsPage();
      if (page.state === "unavailable") {
        return fail(
          503,
          "unavailable",
          "The contributions could not be read. Nothing has changed — please try again.",
        );
      }
      return ok({ donations: page.items });
    });
  } catch (error) {
    return fromError(error);
  }
}

/**
 * Recording a contribution, which writes two records or neither: the income
 * voucher first, then the donation that names it. A figure the public can read
 * without a name beside it, or a name without a figure, is the drift §6 exists to
 * prevent, so the pair is not offered to a caller as two calls.
 */
export async function POST(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_FINANCE, async ({ user }) => {
      const parsed = DONATION_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const written = await saveDonation(parsed.data, user._id);
      if (written.result !== "written") return await refusalFor(written);

      invalidateFinance();
      return ok({ donation: toAdminDonation(written.donation, parsed.data.voucherNo) });
    });
  } catch (error) {
    return fromError(error);
  }
}

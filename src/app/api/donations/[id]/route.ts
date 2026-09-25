import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import {
  editDonation,
  removeDonation,
  toAdminDonation,
  type DonationRefusal,
} from "@/lib/donations";
import { MANAGE_FINANCE, lockedYearMessage } from "@/lib/finance";
import { invalidateFinance } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";
import { DONATION_EDIT_SCHEMA } from "@/lib/validation/donations";

/**
 * One contribution, corrected or taken away.
 *
 * This is the only screen from which a donation's voucher may change, and the
 * change goes through `editDonation` so the name the public reads and the figure
 * in the accounts move together (§6). The finance screens are refused that
 * voucher on purpose: edited on their own, the two records would drift.
 *
 * A correction still asks for the sentence why, and the reason is stored on the
 * voucher beside the old and new figures, where the year's audit trail shows it.
 */

async function refusalFor(refusal: DonationRefusal): Promise<Response> {
  switch (refusal.result) {
    case "not_found":
      return fail(404, "not_found", "No such contribution.");
    case "no_year_for_date":
      return fail(
        400,
        "no_year_for_date",
        `No accounts are kept for ${refusal.date}. Open the financial year ${refusal.fiscalLabel} first, or change the day to one inside a year the branch keeps.`,
      );
    case "locked":
      return fail(409, "year_locked", await lockedYearMessage(refusal.year));
    case "not_kept":
      return fail(
        500,
        "not_kept",
        "The contribution was left as it was, because its ledger line refused the change. Nothing has been published twice or half-changed — please try again, and tell the office if it fails a second time.",
      );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const donationId = requireObjectId(id);

    return await requireRole(request, MANAGE_FINANCE, async ({ user }) => {
      const parsed = DONATION_EDIT_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const saved = await editDonation(donationId, parsed.data, {
        reason: parsed.data.reason,
        byId: user._id,
      });
      if (saved.result !== "written") return await refusalFor(saved);

      invalidateFinance();
      return ok({ donation: toAdminDonation(saved.donation, parsed.data.voucherNo) });
    });
  } catch (error) {
    return fromError(error);
  }
}

/**
 * Taking a contribution back removes both records, the donation first, so the
 * ledger is never left holding an income entry nobody acknowledges. A year that
 * has been closed refuses it like any other write: what the public has read
 * stands until a super-admin reopens the year and says why.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const donationId = requireObjectId(id);

    return await requireRole(request, MANAGE_FINANCE, async () => {
      const removed = await removeDonation(donationId);
      if (removed.result !== "written") return await refusalFor(removed);

      invalidateFinance();
      return ok({ removed: true, deleted: donationId.toHexString() });
    });
  } catch (error) {
    return fromError(error);
  }
}

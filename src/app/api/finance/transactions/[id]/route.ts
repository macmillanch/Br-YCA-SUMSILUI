import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import {
  MANAGE_FINANCE,
  namesForTransactions,
  lockedYearMessage,
  removeTransaction,
  replaceTransaction,
  toAdminTransaction,
  workTitlesFor,
  type TransactionWrite,
} from "@/lib/finance";
import { invalidateFinance } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";
import { TRANSACTION_EDIT_SCHEMA } from "@/lib/validation/finance";

/**
 * One voucher, changed or taken away.
 *
 * A correction is never a overwrite in the dark: `replaceTransaction` works out
 * which fields moved, keeps the old values beside the new ones, and stores the
 * sentence the treasurer gave as the reason. What is left to this route is to
 * turn each refusal into the answer §9 asks for.
 */

type TransactionRefusal = Exclude<TransactionWrite, { result: "written" }>;

async function refusalFor(refusal: TransactionRefusal): Promise<Response> {
  switch (refusal.result) {
    case "not_found":
      return fail(404, "not_found", "No such voucher.");
    case "no_year_for_date":
      return fail(
        400,
        "no_year_for_date",
        `No accounts are kept for ${refusal.date}. Open the financial year ${refusal.fiscalLabel} first, or change the date to a day inside a year the branch keeps.`,
      );
    case "locked":
      return fail(409, "year_locked", await lockedYearMessage(refusal.year));
    case "linked_donation":
      return fail(
        409,
        "donation_linked",
        "This voucher belongs to a recorded donation, so it is changed on the donations screen — the name the public reads and the figure in the accounts must not be edited apart.",
      );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const transactionId = requireObjectId(id);

    return await requireRole(request, MANAGE_FINANCE, async ({ user }) => {
      const parsed = TRANSACTION_EDIT_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const saved = await replaceTransaction(transactionId, parsed.data, user._id);
      if (saved.result !== "written") return await refusalFor(saved);

      invalidateFinance();
      const [names, titles] = await Promise.all([
        namesForTransactions([saved.transaction]),
        workTitlesFor([saved.transaction]),
      ]);
      return ok({ transaction: toAdminTransaction(saved.transaction, names, titles) });
    });
  } catch (error) {
    return fromError(error);
  }
}

/**
 * Removing a voucher is possible only in a year that is still open, and never
 * for one a donation owns. A line that was simply wrong is corrected rather than
 * deleted: a correction leaves the old figure on the page for anyone who read it
 * last month, and a deletion leaves only a hole.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const transactionId = requireObjectId(id);

    return await requireRole(request, MANAGE_FINANCE, async () => {
      const removed = await removeTransaction(transactionId);
      if (removed.result !== "written") return await refusalFor(removed);

      invalidateFinance();
      return ok({ removed: true, deleted: transactionId.toHexString() });
    });
  } catch (error) {
    return fromError(error);
  }
}

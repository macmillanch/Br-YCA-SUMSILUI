import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import {
  REOPEN_FINANCIAL_YEAR,
  getFinancialYear,
  setYearLock,
  toAdminYear,
} from "@/lib/finance";
import { invalidateFinance } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";
import { UNLOCK_REASON_SCHEMA } from "@/lib/validation/finance";

/**
 * Reopening a closed year's accounts — super-admin only, and only with a reason
 * that is kept on the year (§8).
 *
 * The reason is not a formality. A published total that quietly becomes
 * changeable is exactly what a reader of an NGO's accounts is entitled to ask
 * about, so the sentence goes on the year itself and the screens show it there.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const yearId = requireObjectId(id);

    return await requireRole(request, REOPEN_FINANCIAL_YEAR, async ({ user }) => {
      const parsed = UNLOCK_REASON_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const year = await getFinancialYear(yearId);
      if (!year) return fail(404, "not_found", "No such year.");

      const result = await setYearLock(yearId, false, user._id, parsed.data.reason);
      if (result === "already_open") {
        return fail(409, "year_open", `${year.label}'s accounts are already open.`);
      }
      if (result === "not_found") return fail(404, "not_found", "No such year.");

      invalidateFinance();
      const reopened = await getFinancialYear(yearId);
      if (!reopened) return fail(404, "not_found", "That year was removed while it was opening.");
      return ok({ year: toAdminYear(reopened) });
    });
  } catch (error) {
    return fromError(error);
  }
}

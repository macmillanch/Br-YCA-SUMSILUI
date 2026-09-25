import type { NextRequest } from "next/server";
import { fail, fromError, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { MANAGE_FINANCE, getFinancialYear, setYearLock, toAdminYear } from "@/lib/finance";
import { invalidateFinance } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";

/**
 * Closing a year's accounts (§8). This is the safe direction — it takes away
 * the ability to change a figure, so the Treasurer is trusted with it, and the
 * date and the name are kept because the 409 that follows has to say both (§9).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const yearId = requireObjectId(id);

    return await requireRole(request, MANAGE_FINANCE, async ({ user }) => {
      const year = await getFinancialYear(yearId);
      if (!year) return fail(404, "not_found", "No such year.");

      const result = await setYearLock(yearId, true, user._id);
      if (result === "already_locked") {
        return fail(409, "year_locked", `${year.label}'s accounts are already closed.`);
      }
      if (result === "not_found") return fail(404, "not_found", "No such year.");

      invalidateFinance();
      const closed = await getFinancialYear(yearId);
      if (!closed) return fail(404, "not_found", "That year was removed while it was closing.");
      return ok({ year: toAdminYear(closed) });
    });
  } catch (error) {
    return fromError(error);
  }
}

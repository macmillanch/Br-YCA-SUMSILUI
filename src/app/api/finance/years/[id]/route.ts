import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import {
  MANAGE_FINANCE,
  getFinancialYear,
  removeFinancialYear,
  setYearAuditReport,
  toAdminYear,
  yearIsClosed,
} from "@/lib/finance";
import { invalidateFinance } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";
import { YEAR_AUDIT_SCHEMA } from "@/lib/validation/finance";

/**
 * A year's own record: the audit report that goes with it, and its removal.
 *
 * The report is saved separately from opening the year because it arrives
 * later — an audited set of accounts is signed off months after the treasurer
 * started keeping them, which is why this write is allowed on a closed year
 * when nothing else is.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const yearId = requireObjectId(id);

    return await requireRole(request, MANAGE_FINANCE, async () => {
      const parsed = YEAR_AUDIT_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      if (!(await getFinancialYear(yearId))) return fail(404, "not_found", "No such year.");
      const saved = await setYearAuditReport(yearId, parsed.data.auditPdfUrl);
      if (!saved) return fail(404, "not_found", "No such year.");

      invalidateFinance();
      return ok({ year: toAdminYear(saved) });
    });
  } catch (error) {
    return fromError(error);
  }
}

/**
 * §9: a year with vouchers in it is not deleted. The entries would go with it
 * and the totals the public read last week would have nothing underneath them —
 * so the answer is to close it, not to erase it.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const yearId = requireObjectId(id);

    return await requireRole(request, MANAGE_FINANCE, async () => {
      const year = await getFinancialYear(yearId);
      if (!year) return fail(404, "not_found", "No such year.");
      if (yearIsClosed(year)) {
        return fail(
          409,
          "year_locked",
          "A closed year stays. Only a super admin can reopen one, and a year with nothing in it can be removed once it is open.",
        );
      }

      const removed = await removeFinancialYear(yearId);
      if (removed.reason === "transactions_exist") {
        return fail(
          409,
          "year_has_entries",
          `${year.label} has ${removed.count} voucher${removed.count === 1 ? "" : "s"} entered against it, so it cannot be deleted — that would take the entries under a published total with it.`,
        );
      }
      if (!removed.removed) return fail(404, "not_found", "No such year.");

      invalidateFinance();
      return ok({ removed: true, deleted: yearId.toHexString() });
    });
  } catch (error) {
    return fromError(error);
  }
}

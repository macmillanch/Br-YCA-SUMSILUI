import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import {
  MANAGE_FINANCE,
  listFinancialYears,
  openFinancialYear,
  toAdminYear,
} from "@/lib/finance";
import { invalidateFinance } from "@/lib/invalidate";
import { FINANCIAL_YEAR_SCHEMA } from "@/lib/validation/finance";

/**
 * The years the branch keeps accounts for. Only the treasurer's own screens
 * read this: which years exist is already public on `/finance`, and a list that
 * carries lock state is the office's business.
 */
export async function GET(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_FINANCE, async () => {
      const years = await listFinancialYears();
      return ok({ years: years.map(toAdminYear) });
    });
  } catch (error) {
    return fromError(error);
  }
}

/**
 * Opening a year is the one act that makes vouchers possible, so a window that
 * cuts into a year already kept is refused here rather than left to the unique
 * index — two years claiming the same March would split a ledger in two.
 */
export async function POST(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_FINANCE, async () => {
      const parsed = FINANCIAL_YEAR_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const opened = await openFinancialYear(parsed.data);
      if (opened.result === "duplicate_label") {
        return fail(409, "year_exists", `The accounts for ${parsed.data.label} are already kept.`);
      }
      if (opened.result === "overlaps_existing") {
        return fail(
          409,
          "year_overlaps",
          `Those dates fall inside ${opened.overlappingLabel ?? "a year already kept"}, whose accounts would then share vouchers with this one.`,
        );
      }

      invalidateFinance();
      const year = opened.year;
      if (!year) return fail(409, "year_exists", "That year has just been opened.");
      return ok({ year: toAdminYear(year) });
    });
  } catch (error) {
    return fromError(error);
  }
}

import type { NextRequest } from "next/server";
import { fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { getFinanceSummary } from "@/lib/content";
import type { Role } from "@/lib/types";
import { SUMMARY_QUERY_SCHEMA } from "@/lib/validation/finance";

/**
 * The year's totals as JSON (§7). This is the one place the summary is offered
 * to a program rather than printed for a member, and it answers a failed read
 * the same way the page does: `200` with `unavailable: true`.
 *
 * A caller cannot tell an outage from a year with no vouchers except by reading
 * that flag, which is the point of having one. A `500` here would be worse than
 * the flag — it would read as the branch refusing to say.
 */

const READ_THE_FIGURES: readonly Role[] = ["editor", "treasurer"];

export async function GET(request: NextRequest) {
  try {
    return await requireRole(request, READ_THE_FIGURES, async () => {
      const raw = request.nextUrl.searchParams.get("year");
      const parsed = SUMMARY_QUERY_SCHEMA.safeParse({
        year: raw?.trim() ? raw.trim() : undefined,
      });
      if (!parsed.success) return validationFail(parsed.error);

      const { snapshot, unavailable } = await getFinanceSummary(parsed.data.year);
      return ok({ snapshot, unavailable });
    });
  } catch (error) {
    return fromError(error);
  }
}

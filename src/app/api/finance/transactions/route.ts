import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import {
  MANAGE_FINANCE,
  insertTransaction,
  listTransactions,
  lockedYearMessage,
  namesForTransactions,
  toAdminTransaction,
  workTitlesFor,
} from "@/lib/finance";
import { invalidateFinance } from "@/lib/invalidate";
import { toObjectId } from "@/lib/mongo-oid";
import type { Role } from "@/lib/types";
import { LEDGER_QUERY_SCHEMA, TRANSACTION_SCHEMA } from "@/lib/validation/finance";

/**
 * The vouchers themselves. Every figure the public `/finance` pages print is
 * the sum of these, which is why a write here carries three guards: the year is
 * worked out from the date rather than accepted from the request, a closed year
 * takes nothing, and a voucher a donation owns is edited on the donation screen
 * so the two records cannot drift apart (§6).
 */

/** Who may read the book. Reading is not the treasurer's sole privilege. */
const READ_THE_LEDGER: readonly Role[] = ["editor", "treasurer"];

/**
 * A filter left blank on a form is no filter, not a filter for the empty
 * string. Anything else in these slots is the schema's to refuse.
 */
function emptyToUndefined(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function ledgerParams(url: URL): Record<string, string | undefined> {
  const params = url.searchParams;
  return {
    year: emptyToUndefined(params.get("year")),
    project: emptyToUndefined(params.get("project")),
    type: emptyToUndefined(params.get("type")),
    category: emptyToUndefined(params.get("category")),
    q: emptyToUndefined(params.get("q")),
  };
}

export async function GET(request: NextRequest) {
  try {
    return await requireRole(request, READ_THE_LEDGER, async () => {
      const parsed = LEDGER_QUERY_SCHEMA.safeParse(ledgerParams(request.nextUrl));
      if (!parsed.success) return validationFail(parsed.error);

      const rows = await listTransactions({
        yearId: toObjectId(parsed.data.year),
        projectId: toObjectId(parsed.data.project),
        type: parsed.data.type,
        category: parsed.data.category,
        search: parsed.data.q,
      });
      const [names, titles] = await Promise.all([
        namesForTransactions(rows),
        workTitlesFor(rows),
      ]);
      return ok({
        transactions: rows.map((row) => toAdminTransaction(row, names, titles)),
      });
    });
  } catch (error) {
    return fromError(error);
  }
}

/**
 * Entering a voucher. The request has no `yearId` field at all — there is no
 * such choice to make, and a body that could name one is a body that could file
 * an expense inside a year the public has already read.
 */
export async function POST(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_FINANCE, async ({ user }) => {
      const parsed = TRANSACTION_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const written = await insertTransaction(parsed.data, user._id);
      if (written.result === "no_year_for_date") {
        return fail(
          400,
          "no_year_for_date",
          `No accounts are kept for ${written.date}. Open the financial year ${written.fiscalLabel} first, or enter the voucher against a day inside a year the branch keeps.`,
        );
      }
      if (written.result === "locked") {
        return fail(409, "year_locked", await lockedYearMessage(written.year));
      }

      invalidateFinance();
      const transaction = written.transaction;
      const [names, titles] = await Promise.all([
        namesForTransactions([transaction]),
        workTitlesFor([transaction]),
      ]);
      return ok({ transaction: toAdminTransaction(transaction, names, titles) });
    });
  } catch (error) {
    return fromError(error);
  }
}

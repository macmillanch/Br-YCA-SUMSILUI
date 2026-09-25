import type { NextRequest } from "next/server";
import { getFinanceYearDetail } from "@/lib/content";
import { filterLedger, ledgerCsv, parseLedgerFilter } from "@/lib/finance-ledger";

/**
 * The year's ledger as a file.
 *
 * Public, because the ledger it exports is already on a public page — a download
 * behind a sign-in would only hide the accounts from the member they belong to.
 * The route carries the same filters the page does, so the file a reader
 * downloads is the table they were looking at.
 *
 * `no-store` is the point of the header: a spreadsheet of figures the branch may
 * correct this afternoon must not be served from a cache this evening.
 */

/** Never a page's HTML, and never a cached one, whatever the answer is. */
function respond(status: number, contentType: string, body: string, disposition?: string): Response {
  const headers = new Headers({ "Content-Type": contentType, "Cache-Control": "no-store" });
  if (disposition) headers.set("Content-Disposition", disposition);
  return new Response(body, { status, headers });
}

const PLAIN = "text/plain; charset=utf-8";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> },
): Promise<Response> {
  const { year } = await params;
  const detail = await getFinanceYearDetail(year);

  if (detail.state === "missing") {
    return respond(404, PLAIN, `No accounts are kept for ${year}, so there is no ledger to download.\n`);
  }
  if (detail.state === "unavailable") {
    return respond(503, PLAIN, "The accounts could not be read just now. Please try again shortly.\n");
  }

  // The filename is built from the year's own record rather than the address, so
  // a request cannot ask the site for a file called anything it likes.
  const rows = filterLedger(detail.ledger, parseLedgerFilter(request.nextUrl.searchParams));
  const disposition = `attachment; filename="yca-sumsilui-${detail.year.label}.csv"`;

  return respond(200, "text/csv; charset=utf-8", ledgerCsv(rows), disposition);
}

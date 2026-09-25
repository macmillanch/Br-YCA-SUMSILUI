import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinanceBarChart, type ChartBar } from "@/components/site/FinanceBarChart";
import { FinanceSummary } from "@/components/site/FinanceSummary";
import { PageHeader } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  getFinanceYearDetail,
  getFinanceYears,
  type PublicLedgerRow,
} from "@/lib/content";
import { formatPaise } from "@/lib/money";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Finance",
  description:
    "Year-by-year income and expenditure of Young Chakma Association, Sumsilui Branch, published in public view.",
};

const DESCRIPTION =
  "Income and expenditure year by year. Figures are calculated from the branch's ledger entries rather than typed in by hand, so a total always matches the vouchers underneath it.";

/** Two bars, one side of the ledger each, drawn in the colours the accounts use. */
function sideBars(snapshot: { incomePaise: number; expensePaise: number }): ChartBar[] {
  return [
    { label: "Income", paise: snapshot.incomePaise, tone: "income" },
    { label: "Expenditure", paise: snapshot.expensePaise, tone: "expense" },
  ];
}

function VoucherTable({ rows }: { rows: readonly PublicLedgerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">The most recent vouchers entered</caption>
        <thead>
          <tr className="border-b-2 border-green-900 text-left">
            {["Date", "Voucher", "Description", "Party", "Head", "Received", "Paid out"].map(
              (heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={`py-2 pr-4 font-semibold ${
                    heading === "Received" || heading === "Paid out" ? "text-right" : ""
                  }`}
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.voucherNo}-${row.date}`} className="border-b border-line">
              <th scope="row" className="py-2.5 pr-4 text-left font-normal tabular-nums">
                {row.date}
              </th>
              <td className="py-2.5 pr-4">{row.voucherNo}</td>
              <td className="py-2.5 pr-4">{row.description}</td>
              <td className="py-2.5 pr-4">{row.party}</td>
              <td className="py-2.5 pr-4">{row.categoryLabel}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-green-900">
                {row.type === "income" ? formatPaise(row.amountPaise) : ""}
              </td>
              <td className="py-2.5 text-right tabular-nums text-red-700">
                {row.type === "expense" ? formatPaise(row.amountPaise) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  if (year) redirect(`/finance/${encodeURIComponent(year)}`);

  const [years, detail] = await Promise.all([getFinanceYears(), getFinanceYearDetail()]);
  const list = years.state === "ready" ? years.items : [];
  const figures = detail.state === "ready" ? detail : null;

  return (
    <div className="container-page space-y-8 py-10">
      <PageHeader eyebrow="Public accounts" title="Finance" description={DESCRIPTION} />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="financial-year" className="block text-sm font-medium">
            Financial year
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {/* A plain GET form so the year can be chosen with JavaScript switched off. */}
            <form method="get" action="/finance" className="flex items-center gap-3">
              <select
                id="financial-year"
                name="year"
                className="min-h-11 rounded-[4px] border border-line bg-paper px-3 py-2 text-sm"
                defaultValue={figures?.year.label ?? list[0]?.label ?? ""}
              >
                {list.length === 0 ? <option value="">None published</option> : null}
                {list.map((option) => (
                  <option key={option.label} value={option.label}>
                    {option.label}
                    {option.locked ? " (accounts closed)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="min-h-11 rounded-[4px] bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
              >
                Open ledger
              </button>
            </form>
          </div>
        </div>
      </div>
      <p className="text-xs text-ink-muted">A financial year runs from 1 April to 31 March.</p>

      <FinanceSummary
        snapshot={figures?.snapshot ?? null}
        unavailable={detail.state === "unavailable"}
        yearsOpened={list.length}
      />

      {figures ? (
        <>
          <section aria-labelledby="finance-sides" className="space-y-4">
            <h2 id="finance-sides" className="text-2xl">
              Income and expenditure
            </h2>
            <FinanceBarChart
              title="Income and expenditure"
              yearLabel={figures.year.label}
              bars={sideBars(figures.snapshot)}
            />
            <p className="text-sm text-ink-muted">
              {figures.rows.length > 0 ? (
                <>
                  The full ledger for {figures.year.label} is on its own page, with every voucher and
                  a download for the spreadsheet.
                </>
              ) : (
                <>
                  No vouchers have been entered against {figures.year.label} yet, so the figures above
                  are the opening balance the treasurer recorded.
                </>
              )}
            </p>
            <Button href={`/finance/${figures.year.label}`}>
              Ledger for {figures.year.label}
            </Button>
          </section>

          <section aria-labelledby="finance-breakdown" className="space-y-6">
            <h2 id="finance-breakdown" className="text-2xl">
              Where it came from, where it went
            </h2>

            <div className="space-y-3">
              <h3 className="text-lg">Income by head</h3>
              <FinanceBarChart
                title="Income by head"
                yearLabel={figures.year.label}
                bars={figures.income.map((entry) => ({
                  label: entry.label,
                  paise: entry.paise,
                  tone: "income" as const,
                }))}
                withShare
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-lg">Expenditure by head</h3>
              <FinanceBarChart
                title="Expenditure by head"
                yearLabel={figures.year.label}
                bars={figures.expense.map((entry) => ({
                  label: entry.label,
                  paise: entry.paise,
                  tone: "expense" as const,
                }))}
                withShare
              />
            </div>
          </section>

          {figures.rows.length > 0 ? (
            <section aria-labelledby="finance-recent" className="space-y-4">
              <h2 id="finance-recent" className="text-2xl">
                The last {figures.rows.length} voucher
                {figures.rows.length === 1 ? "" : "s"} entered
              </h2>
              <VoucherTable rows={figures.rows} />
            </section>
          ) : null}

          {figures.auditPdfUrl ? (
            <section aria-labelledby="finance-audit" className="space-y-3">
              <h2 id="finance-audit" className="text-lg">
                Audited statement for {figures.year.label}
              </h2>
              <p className="text-sm text-ink-muted">
                The branch has saved the audit report for this year. It is the auditors&rsquo; own
                document, not a figure calculated here.
              </p>
              <Button href={figures.auditPdfUrl} target="_blank" rel="noreferrer">
                Open the audit report
              </Button>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

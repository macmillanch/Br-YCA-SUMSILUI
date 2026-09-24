import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinanceSummary } from "@/components/site/FinanceSummary";
import { PageHeader } from "@/components/site/EmptyState";
import { getFinanceSummary, getFinanceYears } from "@/lib/content";

export const metadata: Metadata = {
  title: "Finance",
  description:
    "Year-by-year income and expenditure of Young Chakma Association, Sumsilui Branch, published in public view.",
};

const DESCRIPTION =
  "Income and expenditure year by year. Figures are calculated from the branch's ledger entries rather than typed in by hand, so a total always matches the vouchers underneath it.";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  if (year) redirect(`/finance/${encodeURIComponent(year)}`);

  const [finance, years] = await Promise.all([getFinanceSummary(), getFinanceYears()]);

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
                defaultValue={years[0]?.label ?? ""}
              >
                {years.length === 0 ? <option value="">None published</option> : null}
                {years.map((year) => (
                  <option key={year.label} value={year.label}>
                    {year.label}
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

      <FinanceSummary finance={finance} />
    </div>
  );
}

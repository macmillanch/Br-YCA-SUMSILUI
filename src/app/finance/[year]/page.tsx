import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { FinanceBarChart } from "@/components/site/FinanceBarChart";
import { getFinanceYearDetail, getFinanceYears } from "@/lib/content";
import { fiscalYearFromLabel } from "@/lib/fiscal-year";
import { formatPaise } from "@/lib/money";

export const revalidate = 300;

export async function generateStaticParams() {
  const years = await getFinanceYears();
  return years.state === "ready" ? years.items.map((year) => ({ year: year.label })) : [];
}

/**
 * Unknown years must fail at the routing layer. Once a page has streamed its
 * 200 headers, a later `notFound()` cannot turn the response into a 404, and a
 * made-up year would otherwise be served as a real page.
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  return {
    title: `Accounts ${year}`,
    description: `The full transaction ledger for the financial year ${year}, 1 April to 31 March.`,
  };
}

export default async function FinanceYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const [known, detail] = await Promise.all([getFinanceYears(), getFinanceYearDetail(year)]);
  const list = known.state === "ready" ? known.items : [];
  if (!list.some((option) => option.label === year)) notFound();

  const period = fiscalYearFromLabel(year);

  return (
    <div className="container-page space-y-8 py-10">
      <PageHeader
        eyebrow={`1 April ${period.startDate.slice(0, 4)} to 31 March ${period.endDate.slice(0, 4)}`}
        title={`Accounts for ${year}`}
        description="The complete ledger for the year, oldest entry first. Income and expenditure can each be filtered by category."
      />

      <nav aria-label="Other financial years" className="flex flex-wrap gap-2 text-sm">
        {list.map((option) => (
          <Link
            key={option.label}
            href={`/finance/${option.label}`}
            aria-current={option.label === year ? "page" : undefined}
            className={`rounded-[4px] border px-3 py-1.5 ${
              option.label === year
                ? "border-green-700 bg-green-100 font-medium text-green-900"
                : "border-line bg-paper text-green-900 hover:bg-green-100"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {known.state === "unavailable" || detail.state === "unavailable" ? (
        <SectionUnavailable what="The figures for this year" />
      ) : detail.state === "missing" ? (
        <EmptyState
          title={`No accounts published for ${year}`}
          body="The vouchers behind a year are entered work by work as they are passed. Once the treasurer closes the year, every entry appears here with its date, voucher number, description, party and amount, and the whole ledger can be downloaded as a spreadsheet."
          action={{ href: "/admin", label: "Office-bearers: sign in to enter vouchers" }}
        />
      ) : (
        <>
          <table className="w-full max-w-lg border-collapse text-sm">
            <caption className="sr-only">Summary for {year}</caption>
            <thead>
              <tr className="border-b-2 border-green-900 text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Head
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Opening balance", value: detail.snapshot.openingPaise },
                { label: "Add: income", value: detail.snapshot.incomePaise },
                { label: "Less: expenses", value: -detail.snapshot.expensePaise },
              ].map((row) => (
                <tr key={row.label} className="border-b border-line">
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                    {row.label}
                  </th>
                  <td className="py-2.5 text-right tabular-nums">{formatPaise(row.value)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-green-900">
                <th scope="row" className="py-3 pr-4 text-left font-semibold">
                  Closing balance
                </th>
                <td className="py-3 text-right font-semibold tabular-nums">
                  {formatPaise(detail.snapshot.closingPaise)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-4">
            <h2 className="text-2xl">Where it came from, where it went</h2>
            <FinanceBarChart
              title="Income by head"
              yearLabel={year}
              bars={detail.income.map((entry) => ({
                label: entry.label,
                paise: entry.paise,
                tone: "income" as const,
              }))}
              withShare
            />
            <FinanceBarChart
              title="Expenditure by head"
              yearLabel={year}
              bars={detail.expense.map((entry) => ({
                label: entry.label,
                paise: entry.paise,
                tone: "expense" as const,
              }))}
              withShare
            />
          </div>
        </>
      )}
    </div>
  );
}

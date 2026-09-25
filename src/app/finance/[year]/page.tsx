import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { FinanceBarChart } from "@/components/site/FinanceBarChart";
import { Button } from "@/components/ui/Button";
import { getFinanceYearDetail, getFinanceYears, type FinanceYearDetail } from "@/lib/content";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryLabel } from "@/lib/finance-categories";
import {
  filterLedger,
  isFiltered,
  parseLedgerFilter,
  type LedgerFilter,
  type PublicLedgerLine,
} from "@/lib/finance-ledger";
import { fiscalYearFromLabel } from "@/lib/fiscal-year";
import { formatPaise } from "@/lib/money";
import type { TransactionCategory } from "@/lib/types";

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

/**
 * The filter, back as query parameters. Rebuilt from what was understood rather
 * than from the raw URL, so a link that says `?type=both` offers a clean export
 * of the year rather than passing the nonsense on.
 */
function exportQuery(filter: LedgerFilter): string {
  const params = new URLSearchParams();
  if (filter.type) params.set("type", filter.type);
  if (filter.category) params.set("category", filter.category);
  if (filter.search) params.set("q", filter.search);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function HeadOptions({ categories }: { categories: readonly TransactionCategory[] }) {
  return (
    <>
      {categories.map((category) => (
        <option key={category} value={category}>
          {categoryLabel(category)}
        </option>
      ))}
    </>
  );
}

function LedgerTable({ rows }: { rows: readonly PublicLedgerLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <caption className="sr-only">
          Every voucher of the year, oldest first, with the balance after each one
        </caption>
        <thead>
          <tr className="border-b-2 border-green-900 text-left">
            {[
              "Date",
              "Voucher",
              "Description",
              "Party",
              "Head",
              "Received",
              "Paid out",
              "Balance",
            ].map((heading) => (
              <th
                key={heading}
                scope="col"
                className={`py-2 pr-4 font-semibold ${
                  heading === "Received" || heading === "Paid out" || heading === "Balance"
                    ? "text-right"
                    : ""
                }`}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.voucherNo}-${row.date}-${row.amountPaise}`}
              className="border-b border-line"
            >
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
              <td className="py-2.5 pr-4 text-right tabular-nums text-red-700">
                {row.type === "expense" ? formatPaise(row.amountPaise) : ""}
              </td>
              <td className="py-2.5 text-right tabular-nums">
                {formatPaise(row.runningBalancePaise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FinanceYearPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { year } = await params;
  const [known, detail, query] = await Promise.all([
    getFinanceYears(),
    getFinanceYearDetail(year),
    searchParams,
  ]);
  const list = known.state === "ready" ? known.items : [];
  if (!list.some((option) => option.label === year)) notFound();

  const period = fiscalYearFromLabel(year);

  return (
    <div className="container-page space-y-8 py-10">
      <PageHeader
        eyebrow={`1 April ${period.startDate.slice(0, 4)} to 31 March ${period.endDate.slice(0, 4)}`}
        title={`Accounts for ${year}`}
        description="The complete ledger for the year, oldest entry first, with the balance the branch held after each voucher. Income and expenditure can each be filtered by head."
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
        notFound()
      ) : (
        <YearLedger year={year} detail={detail} filter={parseLedgerFilter(query)} />
      )}
    </div>
  );
}

function YearLedger({
  year,
  detail,
  filter,
}: {
  year: string;
  detail: Extract<FinanceYearDetail, { state: "ready" }>;
  filter: LedgerFilter;
}) {
  const shown = filterLedger(detail.ledger, filter);
  const total = detail.ledger.length;
  const filtered = isFiltered(filter);

  return (
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

      <section aria-labelledby="ledger-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="ledger-heading" className="text-2xl">
            The ledger
          </h2>
          <Button href={`/finance/${year}/export${exportQuery(filter)}`} download>
            Download this year as a spreadsheet (CSV)
          </Button>
        </div>

        {/* A GET form, so a filtered view has an address of its own that can be
            shared and works with JavaScript switched off. */}
        <form method="get" action={`/finance/${year}`} className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="ledger-type" className="block text-sm font-medium">
              Direction
            </label>
            <select
              id="ledger-type"
              name="type"
              defaultValue={filter.type ?? ""}
              className="mt-2 min-h-11 rounded-[4px] border border-line bg-paper px-3 py-2 text-sm"
            >
              <option value="">Income and expenditure</option>
              <option value="income">Money received</option>
              <option value="expense">Money paid out</option>
            </select>
          </div>

          <div>
            <label htmlFor="ledger-category" className="block text-sm font-medium">
              Head
            </label>
            <select
              id="ledger-category"
              name="category"
              defaultValue={filter.category ?? ""}
              className="mt-2 min-h-11 rounded-[4px] border border-line bg-paper px-3 py-2 text-sm"
            >
              <option value="">Every head</option>
              <optgroup label="Money received">
                <HeadOptions categories={INCOME_CATEGORIES} />
              </optgroup>
              <optgroup label="Money paid out">
                <HeadOptions categories={EXPENSE_CATEGORIES} />
              </optgroup>
            </select>
          </div>

          <div>
            <label htmlFor="ledger-q" className="block text-sm font-medium">
              Voucher number, party or description
            </label>
            <input
              id="ledger-q"
              name="q"
              type="search"
              defaultValue={filter.search}
              className="mt-2 min-h-11 w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm sm:w-72"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="min-h-11 rounded-[4px] bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
            >
              Apply
            </button>
            {filtered ? (
              <Link
                href={`/finance/${year}`}
                className="min-h-11 rounded-[4px] border border-line px-4 py-2 text-sm text-green-900 hover:bg-green-100"
              >
                Show the whole year
              </Link>
            ) : null}
          </div>
        </form>

        <p className="text-sm text-ink-muted">
          {total === 0
            ? `No vouchers have been entered against ${year} yet, so the figures above are the opening balance the treasurer recorded.`
            : filtered
              ? `Showing ${shown.length} of ${total} entr${total === 1 ? "y" : "ies"} for ${year}. The totals and the charts above are the whole year, not the part shown here.`
              : `All ${total} entr${total === 1 ? "y" : "ies"} for ${year}, oldest first. The balance beside each line is what the branch held after it.`}
        </p>

        {shown.length > 0 ? (
          <LedgerTable rows={shown} />
        ) : total > 0 ? (
          <p className="rounded-[4px] border border-line bg-paper-alt p-4 text-sm">
            No voucher of {year} matches the filter. Clear it to see the whole year.
          </p>
        ) : null}
      </section>

      {detail.auditPdfUrl ? (
        <section aria-labelledby="ledger-audit" className="space-y-3">
          <h2 id="ledger-audit" className="text-lg">
            Audited statement for {year}
          </h2>
          <p className="text-sm text-ink-muted">
            The branch has saved the audit report for this year. It is the auditors&rsquo; own
            document, not a figure calculated here.
          </p>
          <Button href={detail.auditPdfUrl} target="_blank" rel="noreferrer">
            Open the audit report
          </Button>
        </section>
      ) : null}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { TransactionForm } from "@/components/admin/TransactionForm";
import { TransactionsTable } from "@/components/admin/TransactionsTable";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryLabel } from "@/lib/finance-categories";
import {
  MANAGE_FINANCE,
  adminYearPage,
  namesForTransactions,
  toAdminTransaction,
  workTitlesFor,
} from "@/lib/finance";
import {
  filterLedger,
  isFiltered,
  parseLedgerFilter,
  type LedgerFilter,
} from "@/lib/finance-ledger";
import { formatPaise } from "@/lib/money";
import { listProjects } from "@/lib/projects";
import { isFiscalLabel } from "@/lib/validation/finance";
import type { TransactionCategory } from "@/lib/types";

export const metadata: Metadata = { title: "Vouchers", robots: { index: false } };

/**
 * The filter, back as query parameters, so the download of a filtered year is the
 * same table the screen is showing.
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

/** One side of the year, head by head, in the order the figures fall. */
function Breakdown({
  title,
  totals,
  tone,
}: {
  title: string;
  totals: { label: string; paise: number; share: number }[];
  tone: "income" | "expense";
}) {
  if (totals.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-line bg-paper-alt p-5">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">Nothing under any head yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-line bg-paper-alt p-5">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <dl className="mt-3 space-y-1.5 text-sm">
        {totals.map((entry) => (
          <div key={entry.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">{entry.label}</dt>
            <dd className="tabular-nums">
              <span className={tone === "income" ? "text-green-900" : "text-red-700"}>
                {formatPaise(entry.paise)}
              </span>
              <span className="ml-2 text-xs text-ink-muted">
                {Math.round(entry.share * 100)}%
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function VoucherBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { year } = await params;
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_FINANCE)) {
    return (
      <NotPermitted
        title="Vouchers"
        body="The vouchers themselves are entered and corrected by the Treasurer. An editor can read the published accounts but not change the book."
      />
    );
  }

  // The label is the address of a year, and a page cannot stream a 404 after its
  // headers — so anything that is not a year the books could be kept under stops
  // here rather than reaching Mongo with it.
  if (!isFiscalLabel(year)) notFound();

  const query = await searchParams;
  const { page, docs } = await adminYearPage(year);

  if (page.state === "missing") notFound();

  if (page.state === "unavailable") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl">Vouchers{page.year ? ` for ${page.year.label}` : ""}</h1>
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          The figures {page.year ? `for ${page.year.label} ` : ""}could not be read just now, so
          nothing is shown rather than a part of the year. The public pages say the same. Try again
          in a moment; if it continues, the database needs looking at.
        </p>
      </div>
    );
  }

  const [projects, names, titles] = await Promise.all([
    listProjects(),
    namesForTransactions(docs),
    workTitlesFor(docs),
  ]);
  const works = projects
    .map((project) => ({ id: project._id.toHexString(), title: project.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const vouchers = docs.map((doc) => toAdminTransaction(doc, names, titles));
  const filter = parseLedgerFilter(query);
  const shown = filterLedger(vouchers, filter);
  const filtered = isFiltered(filter);
  const period = { startDate: page.year.startDate, endDate: page.year.endDate };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">
            <Link
              href="/admin/finance"
              className="text-green-700 underline underline-offset-2"
            >
              All years
            </Link>
          </p>
          <h1 className="mt-1 text-2xl">Vouchers for {page.year.label}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {page.entryCount === 0
              ? "Nothing has been entered against this year yet."
              : `${page.entryCount} voucher${page.entryCount === 1 ? "" : "s"} entered, oldest first.`}{" "}
            Everything the public reads for {page.year.label} is the sum of these lines.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/finance/${page.year.label}/export${exportQuery(filter)}`}
            className="rounded-[4px] border border-line px-3 py-1.5 text-green-900 hover:bg-green-100"
          >
            Download as a spreadsheet
          </Link>
          <Link
            href={`/finance/${page.year.label}`}
            className="rounded-[4px] border border-line px-3 py-1.5 text-green-900 hover:bg-green-100"
          >
            Public page
          </Link>
        </div>
      </div>

      {page.lockMessage ? (
        <p className="rounded-[4px] border border-line bg-paper-alt px-3 py-2 text-sm text-ink-muted">
          {page.lockMessage}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Opening balance", paise: page.totals.openingPaise, tone: "" },
          { label: "Income", paise: page.totals.incomePaise, tone: "text-green-900" },
          { label: "Paid out", paise: page.totals.expensePaise, tone: "text-red-700" },
          { label: "Closing balance", paise: page.totals.closingPaise, tone: "" },
        ].map((figure) => (
          <div
            key={figure.label}
            className="rounded-[12px] border border-line bg-paper-alt p-5"
          >
            <p className="text-sm text-ink-muted">{figure.label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${figure.tone}`}>
              {formatPaise(figure.paise)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Breakdown title="Income, head by head" totals={page.income} tone="income" />
        <Breakdown title="Paid out, head by head" totals={page.expense} tone="expense" />
      </div>

      <TransactionForm works={works} yearWindow={period} lockMessage={page.lockMessage} />

      <section aria-labelledby="book-heading" className="space-y-5">
        <h2 id="book-heading" className="text-lg">
          The book
        </h2>

        {/* A GET form, so a filtered view has an address of its own and works
            with JavaScript switched off — the same rule the public ledger follows. */}
        <form
          method="get"
          action={`/admin/finance/${page.year.label}`}
          className="flex flex-wrap items-end gap-4"
        >
          <div>
            <label htmlFor="book-type" className="block text-sm font-medium">
              Direction
            </label>
            <select
              id="book-type"
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
            <label htmlFor="book-category" className="block text-sm font-medium">
              Head
            </label>
            <select
              id="book-category"
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
            <label htmlFor="book-q" className="block text-sm font-medium">
              Voucher number, party or description
            </label>
            <input
              id="book-q"
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
                href={`/admin/finance/${page.year.label}`}
                className="min-h-11 rounded-[4px] border border-line px-4 py-2 text-sm text-green-900 hover:bg-green-100"
              >
                Show the whole year
              </Link>
            ) : null}
          </div>
        </form>

        <p className="text-sm text-ink-muted">
          {filtered
            ? `Showing ${shown.length} of ${vouchers.length} lines. The four figures above are the whole year, not the part shown here.`
            : "Every line of the year is shown above. The figures in a line are what the branch actually paid or received; the head decides which published total it adds to."}
        </p>

        {shown.length > 0 ? (
          <TransactionsTable
            vouchers={shown}
            locked={page.year.locked}
            works={works}
            yearWindow={period}
          />
        ) : (
          <p className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
            {filtered
              ? "No voucher of this year matches the filter. Clear it to see the whole year."
              : "Nothing has been entered against this year yet. The first voucher entered appears in the public accounts within five minutes."}
          </p>
        )}
      </section>
    </div>
  );
}

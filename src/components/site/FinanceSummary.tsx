import { Button } from "@/components/ui/Button";
import { SectionUnavailable } from "@/components/site/EmptyState";
import { formatPaise } from "@/lib/money";
import type { FinanceSnapshot } from "@/lib/content";

/**
 * The published year, or the honesty of none.
 *
 * Figures reach this component from the ledger and nowhere else, which is why it
 * has three answers rather than one: a year the treasurer has totalled, a branch
 * that has not opened a year yet, and a database that would not answer. The last
 * of these must not be rendered as the second — a page of `₹0` is a financial
 * claim nobody made, and it reads as more certain than an apology (§9).
 */
export function FinanceSummary({
  snapshot,
  unavailable = false,
  yearsOpened = 0,
}: {
  snapshot: FinanceSnapshot | null;
  unavailable?: boolean;
  yearsOpened?: number;
}) {
  if (unavailable) return <SectionUnavailable what="The branch's figures" />;

  if (!snapshot) {
    return (
      <div className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
        {yearsOpened === 0
          ? "No financial year has been published yet. Figures appear here once the treasurer opens a year and enters the vouchers against it."
          : "No figures are published for that year yet. The year exists, but nothing has been totalled from it."}
      </div>
    );
  }

  const rows = [
    { label: "Income this year", value: snapshot.incomePaise, hint: "Donations, grants, collections" },
    { label: "Expenses this year", value: snapshot.expensePaise, hint: "Works, events, running costs" },
    {
      label: "Balance on hand",
      value: snapshot.closingPaise,
      hint: `Opening ${formatPaise(snapshot.openingPaise)} plus income, less expenses`,
    },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-[12px] border border-line bg-paper p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {row.label}
            </p>
            <p
              className={`mt-2 font-display text-2xl tabular-nums ${
                row.value < 0 ? "text-red-700" : "text-green-900"
              }`}
            >
              {formatPaise(row.value)}
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">{row.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Financial year {snapshot.yearLabel} (1 April to 31 March)
          {snapshot.closingPaise < 0 ? ", and the year has spent more than it holds" : ""}.
        </p>
        <Button href="/finance" variant="ghost">
          View full financial report
        </Button>
      </div>
    </div>
  );
}

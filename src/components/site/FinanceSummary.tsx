import { Button } from "@/components/ui/Button";
import { DemoFlag } from "@/components/ui/Badge";
import { formatPaise } from "@/lib/money";
import type { FinanceSnapshot } from "@/lib/content";

export function FinanceSummary({
  finance,
  isSample,
}: {
  finance: FinanceSnapshot | null;
  isSample: boolean;
}) {
  if (!finance) {
    return (
      <div className="rounded-[12px] border border-line bg-paper-alt p-6 text-sm text-ink-muted">
        No financial year has been published yet. Figures appear here once the treasurer closes a
        year&rsquo;s accounts.
      </div>
    );
  }

  const rows = [
    { label: "Income this year", value: finance.incomePaise, hint: "Donations, grants, collections" },
    { label: "Expenses this year", value: finance.expensePaise, hint: "Works, events, running costs" },
    {
      label: "Balance on hand",
      value: finance.closingPaise,
      hint: `Opening ${formatPaise(finance.openingPaise)} plus income, less expenses`,
    },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-[12px] border border-line bg-paper p-5"
          >
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
          Financial year {finance.yearLabel} (1 April to 31 March).
          {isSample ? (
            <>
              {" "}
              <DemoFlag label="Demo figures" /> These amounts are layout samples, not branch accounts.
            </>
          ) : null}
        </p>
        <Button href="/finance" variant="ghost">
          View full financial report
        </Button>
      </div>
    </div>
  );
}

import { categoryLabel } from "@/lib/finance-categories";
import type { FinanceSnapshot } from "@/lib/content";
import { sumPaise } from "@/lib/money";
import type { TransactionCategory, TransactionType } from "@/lib/types";
import type { ObjectId } from "mongodb";

/**
 * The arithmetic of a financial year, kept apart from the database so it can be
 * tested with a hand-written ledger.
 *
 * Every figure a public page prints is decided here: the opening balance plus
 * income minus expenditure, each head's share of its own side, and each work's
 * spending. Nothing in this module reads a collection, knows what a lock is, or
 * formats money for a screen — so a mistake in it is a wrong number rather than
 * a wrong number *and* a broken page, and §10 can assert it in paise.
 */

/**
 * What a summary needs from a voucher, and nothing else. A document straight
 * from the collection satisfies this, which is why the pages and the tests
 * share one arithmetic.
 */
export type LedgerRow = {
  type: TransactionType;
  category: TransactionCategory;
  amountPaise: number;
  projectId?: ObjectId | null;
};

/** The four figures of a year. The year's own name belongs to the caller, who read it. */
export type FinanceTotals = Omit<FinanceSnapshot, "yearLabel">;

/** One head of the breakdown, with the share of its side the chart draws. */
export type CategoryTotal = {
  category: TransactionCategory;
  label: string;
  paise: number;
  share: number;
};

export function summarise(
  openingBalancePaise: number,
  rows: readonly LedgerRow[],
): FinanceTotals {
  let incomePaise = 0;
  let expensePaise = 0;

  for (const row of rows) {
    if (row.type === "income") incomePaise += row.amountPaise;
    else expensePaise += row.amountPaise;
  }

  return {
    openingPaise: openingBalancePaise,
    incomePaise,
    expensePaise,
    closingPaise: openingBalancePaise + incomePaise - expensePaise,
  };
}

/**
 * One side's breakdown, largest head first, so a chart reads in the order a
 * treasurer would list it. A head with nothing in it is left out rather than
 * printed as a zero bar: the tables below the chart carry the fixed list of
 * heads, and a zero here would only be noise.
 */
export function totalsByCategory(
  rows: readonly LedgerRow[],
  type: TransactionType,
): CategoryTotal[] {
  const paiseByCategory = new Map<TransactionCategory, number>();

  for (const row of rows) {
    if (row.type !== type) continue;
    paiseByCategory.set(
      row.category,
      (paiseByCategory.get(row.category) ?? 0) + row.amountPaise,
    );
  }

  const kept = [...paiseByCategory.entries()].filter(([, paise]) => paise !== 0);
  const totalPaise = kept.reduce((sum, [, paise]) => sum + paise, 0);
  if (totalPaise === 0) return [];

  return kept
    .map(([category, paise]) => ({
      category,
      label: categoryLabel(category),
      paise,
      share: paise / totalPaise,
    }))
    .sort((a, b) => b.paise - a.paise || a.category.localeCompare(b.category));
}

/**
 * What went out against each work. Money received is not money spent, so an
 * income row never adds to a work's figure even when it is linked to one; a
 * work that appears only as income has no key here at all, which the pages read
 * as nothing spent.
 */
export function spendByProject(rows: readonly LedgerRow[]): Map<string, number> {
  const spend = new Map<string, number>();

  for (const row of rows) {
    if (row.type !== "expense" || !row.projectId) continue;
    const id = row.projectId.toHexString();
    spend.set(id, (spend.get(id) ?? 0) + row.amountPaise);
  }

  return spend;
}

/**
 * How much of a sanctioned amount has been spent, as a percentage. A work with
 * nothing sanctioned has no share of anything, so this says nothing rather than
 * dividing by zero.
 */
export function budgetSharePct(spentPaise: number, sanctionedPaise: number): number | null {
  if (!Number.isFinite(sanctionedPaise) || sanctionedPaise <= 0) return null;
  return (spentPaise / sanctionedPaise) * 100;
}

/** A voucher with the year's balance beside it, as a printed cash book shows it. */
export type BalancedRow<R extends LedgerRow> = R & { runningBalancePaise: number };

/**
 * The running balance down a ledger printed oldest-first.
 *
 * The caller hands these over in date order, because that is the order an
 * audited cash book reads in; this only walks it. `sumPaise` carries the
 * arithmetic so a voucher amount that somehow arrived as a fraction is refused
 * here rather than half-added into a figure the branch publishes.
 */
export function withRunningBalance<R extends LedgerRow>(
  openingBalancePaise: number,
  rows: readonly R[],
): BalancedRow<R>[] {
  let balance = openingBalancePaise;

  return rows.map((row) => {
    balance = sumPaise([balance, row.type === "income" ? row.amountPaise : -row.amountPaise]);
    return { ...row, runningBalancePaise: balance };
  });
}

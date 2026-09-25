import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  budgetSharePct,
  spendByProject,
  summarise,
  totalsByCategory,
  type LedgerRow,
} from "@/lib/finance-summary";

/**
 * §10's fixture ledger, in paise: a year that opened at ₹25,000, took in
 * ₹5,00,000 and spent ₹1,25,000 closes at ₹4,00,000. Every figure a public
 * page prints comes out of this arithmetic, so it is asserted in paise and
 * never through a formatted string — a rounding bug in the label would otherwise
 * hide a wrong total.
 */

function row(over: Partial<LedgerRow> = {}): LedgerRow {
  return {
    type: "income",
    category: "donation",
    amountPaise: 100000,
    ...over,
  };
}

describe("summarise", () => {
  it("closes the year at opening plus income minus expense", () => {
    const totals = summarise(2500000, [
      row({ amountPaise: 30000000 }),
      row({ amountPaise: 20000000 }),
      row({ type: "expense", category: "event", amountPaise: 12500000 }),
    ]);

    expect(totals).toEqual({
      openingPaise: 2500000,
      incomePaise: 50000000,
      expensePaise: 12500000,
      closingPaise: 40000000,
    });
  });

  it("returns the opening balance untouched when nothing has been entered", () => {
    const totals = summarise(2500000, []);

    expect(totals).toEqual({
      openingPaise: 2500000,
      incomePaise: 0,
      expensePaise: 0,
      closingPaise: 2500000,
    });
  });

  it("keeps a year that has spent more than it holds", () => {
    const totals = summarise(0, [row({ type: "expense", category: "relief", amountPaise: 500000 })]);

    expect(totals.incomePaise).toBe(0);
    expect(totals.closingPaise).toBe(-500000);
  });
});

describe("totalsByCategory", () => {
  const fiveRows: LedgerRow[] = [
    row({ category: "donation", amountPaise: 50000000 }),
    row({ category: "subscription", amountPaise: 25000000 }),
    row({ category: "subscription", amountPaise: 5000000 }),
    row({ category: "grant", amountPaise: 20000000 }),
    row({ category: "interest", amountPaise: 16000000 }),
    row({ type: "expense", category: "event", amountPaise: 999 }),
  ];

  it("adds up each head on its own side and ignores the other side", () => {
    const income = totalsByCategory(fiveRows, "income");

    expect(income.map((entry) => [entry.category, entry.paise])).toEqual([
      ["donation", 50000000],
      ["subscription", 30000000],
      ["grant", 20000000],
      ["interest", 16000000],
    ]);
  });

  it("prints the head with the words a member reads", () => {
    expect(totalsByCategory(fiveRows, "income")[0]?.label).toBe("Donations");
    expect(totalsByCategory(fiveRows, "expense")[0]?.label).toBe("Events");
  });

  it("reports shares of that side's total, largest first", () => {
    const income = totalsByCategory(fiveRows, "income");
    const shares = income.map((entry) => entry.share);

    expect(shares.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 9);
    expect(income.map((entry) => entry.paise)).toEqual(
      [...income.map((entry) => entry.paise)].sort((a, b) => b - a),
    );
  });

  it("has no row and no NaN when a side has no money at all", () => {
    expect(totalsByCategory(fiveRows, "expense")).toHaveLength(1);
    expect(totalsByCategory([], "expense")).toEqual([]);
    expect(totalsByCategory([row()], "expense")).toEqual([]);
  });
});

describe("spendByProject", () => {
  const work = new ObjectId();
  const other = new ObjectId();

  it("adds up what went out against each work", () => {
    const spend = spendByProject([
      row({ type: "expense", category: "event", amountPaise: 40000000, projectId: work }),
      row({ type: "expense", category: "relief", amountPaise: 10000000, projectId: work }),
      row({ type: "expense", category: "education", amountPaise: 5000000, projectId: other }),
    ]);

    expect(spend.get(work.toHexString())).toBe(50000000);
    expect(spend.get(other.toHexString())).toBe(5000000);
  });

  it("counts money received against a work as none of its spending", () => {
    const spend = spendByProject([
      row({ amountPaise: 25000000, projectId: work }),
      row({ type: "expense", category: "event", amountPaise: 5000000, projectId: other }),
    ]);

    expect(spend.get(work.toHexString())).toBeUndefined();
    expect(spend.get(work.toHexString()) ?? 0).toBe(0);
    expect(spend.get(other.toHexString())).toBe(5000000);
  });

  it("leaves out money that was not spent on any work", () => {
    const spend = spendByProject([
      row({ type: "expense", category: "administration", amountPaise: 5000000 }),
    ]);

    expect(spend.size).toBe(0);
  });
});

describe("budgetSharePct", () => {
  it("says how much of a sanctioned amount has been spent", () => {
    expect(budgetSharePct(50000000, 100000000)).toBe(50);
    expect(budgetSharePct(125000000, 100000000)).toBe(125);
    expect(budgetSharePct(0, 100000000)).toBe(0);
  });

  it("says nothing when nothing was sanctioned", () => {
    expect(budgetSharePct(5000000, 0)).toBeNull();
    expect(budgetSharePct(0, 0)).toBeNull();
  });
});

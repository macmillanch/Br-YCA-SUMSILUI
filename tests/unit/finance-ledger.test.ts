import { describe, expect, it } from "vitest";
import {
  LEDGER_HEADS,
  filterLedger,
  isFiltered,
  ledgerCsv,
  parseLedgerFilter,
  type LedgerFilter,
  type PublicLedgerLine,
} from "@/lib/finance-ledger";

/**
 * The printed ledger: every voucher of a year, oldest first, with the year's
 * running balance beside each line, and the filters a reader uses to find
 * something in it.
 *
 * The balance is worked out over the whole year before the filter is applied —
 * see `withRunningBalance` — so a screen showing only the grants still says what
 * the branch held on the day each grant came in. A filter that narrowed the
 * figures too would be a different year, and would have to be labelled as one.
 */

function line(over: Partial<PublicLedgerLine> = {}): PublicLedgerLine {
  return {
    date: "2026-04-12",
    voucherNo: "SUM-001",
    description: "Membership subscription collected",
    party: "Office-bearers",
    type: "income",
    category: "subscription",
    categoryLabel: "Membership subscription",
    amountPaise: 500000,
    runningBalancePaise: 3000000,
    ...over,
  };
}

const LEDGER: PublicLedgerLine[] = [
  line(),
  line({
    date: "2026-05-01",
    voucherNo: "SUM-002",
    description: "Donation for the annual meet",
    party: "Sri Chakma Welfare Board",
    type: "income",
    category: "donation",
    categoryLabel: "Donations",
    amountPaise: 50000000,
    runningBalancePaise: 53000000,
  }),
  line({
    date: "2026-05-14",
    voucherNo: "SUM-003",
    description: "Repast, stage and lights",
    party: "R.C. Das & Co, Sumsilui",
    type: "expense",
    category: "event",
    categoryLabel: "Events",
    amountPaise: 12500000,
    runningBalancePaise: 40500000,
  }),
];

describe("parseLedgerFilter", () => {
  it("reads no parameters as no filter", () => {
    expect(parseLedgerFilter({})).toEqual({ type: null, category: null, search: "" });
  });

  it("treats a blank select as no filter rather than a filter for nothing", () => {
    expect(parseLedgerFilter({ type: "", category: "", q: "  " })).toEqual({
      type: null,
      category: null,
      search: "",
    });
  });

  it("keeps a direction and a head it recognises", () => {
    expect(parseLedgerFilter({ type: "expense", category: "relief" })).toEqual({
      type: "expense",
      category: "relief",
      search: "",
    });
  });

  it("ignores a direction or a head that is not one, so a typed URL cannot break the page", () => {
    expect(parseLedgerFilter({ type: "both", category: "secret" })).toEqual({
      type: null,
      category: null,
      search: "",
    });
  });

  it("keeps the search as it was typed, minus the spaces around it", () => {
    expect(parseLedgerFilter({ q: "  annual meet  " }).search).toBe("annual meet");
  });

  it("takes the first value when a link names a filter twice", () => {
    expect(parseLedgerFilter({ type: ["income", "expense"] }).type).toBe("income");
  });

  it("reads the same filter from a request's own parameters, which the download uses", () => {
    const params = new URLSearchParams("type=expense&category=relief&q=drain");

    expect(parseLedgerFilter(params)).toEqual({
      type: "expense",
      category: "relief",
      search: "drain",
    });
  });

  it("lists every head the book uses, so a page can build the choices from it", () => {
    expect(LEDGER_HEADS).toContain("subscription");
    expect(LEDGER_HEADS).toContain("other_expense");
    expect(new Set(LEDGER_HEADS).size).toBe(LEDGER_HEADS.length);
  });
});

describe("isFiltered", () => {
  const NONE: LedgerFilter = { type: null, category: null, search: "" };

  it("says plain when nothing was asked for", () => {
    expect(isFiltered(NONE)).toBe(false);
    expect(isFiltered({ ...NONE, type: "income" })).toBe(true);
    expect(isFiltered({ ...NONE, category: "relief" })).toBe(true);
    expect(isFiltered({ ...NONE, search: "meet" })).toBe(true);
  });
});

describe("filterLedger", () => {
  it("keeps every line when nothing was asked for", () => {
    expect(filterLedger(LEDGER, { type: null, category: null, search: "" })).toHaveLength(3);
  });

  it("keeps one direction only", () => {
    expect(filterLedger(LEDGER, { type: "expense", category: null, search: "" })).toEqual([
      LEDGER[2],
    ]);
  });

  it("keeps one head only", () => {
    expect(
      filterLedger(LEDGER, { type: null, category: "donation", search: "" }).map((row) => row.voucherNo),
    ).toEqual(["SUM-002"]);
  });

  it("finds a voucher by its number, its party or what the money was for", () => {
    const byNumber = filterLedger(LEDGER, { type: null, category: null, search: "sum-003" });
    const byParty = filterLedger(LEDGER, { type: null, category: null, search: "das" });
    const byDescription = filterLedger(LEDGER, { type: null, category: null, search: "repast" });

    expect(byNumber.map((row) => row.voucherNo)).toEqual(["SUM-003"]);
    expect(byParty.map((row) => row.voucherNo)).toEqual(["SUM-003"]);
    expect(byDescription.map((row) => row.voucherNo)).toEqual(["SUM-003"]);
  });

  it("applies the three together, which is how a reader narrows a year", () => {
    const filter = { type: "income", category: "donation", search: "annual" } as const;

    expect(filterLedger(LEDGER, filter)).toEqual([LEDGER[1]]);
  });

  it("leaves the lines in the order the ledger was printed in", () => {
    const balanced = filterLedger(LEDGER, { type: "income", category: null, search: "" });

    expect(balanced.map((row) => row.runningBalancePaise)).toEqual([3000000, 53000000]);
  });

  it("says nothing matched rather than showing the whole year", () => {
    expect(
      filterLedger(LEDGER, { type: null, category: null, search: "nothing here" }),
    ).toEqual([]);
  });
});

describe("ledgerCsv", () => {
  it("writes a header even for a filter that matched nothing", () => {
    expect(ledgerCsv([])).toBe(
      `\uFEFF"Date","Voucher no.","Description","Party","Head","Received","Paid out","Running balance"\r\n`,
    );
  });

  it("puts a rupee figure in the column its direction belongs to, as a number", () => {
    const csv = ledgerCsv([LEDGER[2]!]);

    expect(csv).toContain(`"Repast, stage and lights","R.C. Das & Co, Sumsilui","Events","",125000,405000`);
  });

  it("writes the money in rupees so the treasurer's column adds up", () => {
    const csv = ledgerCsv([LEDGER[0]!]);

    expect(csv).toContain(`"Membership subscription collected","Office-bearers","Membership subscription",5000,"",30000`);
  });

  it("does not let a description become a formula in somebody's Excel", () => {
    const csv = ledgerCsv([
      line({ description: "=cmd|'/C calc'!A0", party: "+SUM(1,1)" }),
    ]);

    expect(csv).toContain(`"'=cmd|'/C calc'!A0","'+SUM(1,1)"`);
  });
});

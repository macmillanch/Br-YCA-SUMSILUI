import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { closedLabelsOf, lockMessage, openLabelsOf, toAdminYearPage, toAdminYearRow, yearsOverlap } from "@/lib/finance";
import type { LedgerRow } from "@/lib/finance-summary";
import { FINANCIAL_YEAR_SCHEMA, UNLOCK_REASON_SCHEMA } from "@/lib/validation/finance";
import type { FinancialYearDoc } from "@/lib/types";

const YEAR = {
  label: "2026-27",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
};

function yearDoc(over: Partial<FinancialYearDoc> = {}): FinancialYearDoc {
  return {
    _id: new ObjectId(),
    ...YEAR,
    openingBalancePaise: 0,
    locked: true,
    lockedAt: new Date("2026-09-24T18:00:00+05:30"),
    lockedById: new ObjectId(),
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-09-24T00:00:00Z"),
    ...over,
  };
}

/**
 * The label is the only form of a year's name the branch uses, so a typed
 * window cannot disagree with the fiscal year the ledger sorts itself into.
 */
describe("FINANCIAL_YEAR_SCHEMA", () => {
  it("accepts a real fiscal year and a zero opening balance", () => {
    const parsed = FINANCIAL_YEAR_SCHEMA.safeParse({
      label: "2026-27",
      openingBalancePaise: 0,
      auditPdfUrl: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a label that is not a 1 April to 31 March year", () => {
    for (const label of ["2026-12", "2026-28", "2026", "26-27", "2026/27"]) {
      const parsed = FINANCIAL_YEAR_SCHEMA.safeParse({
        label,
        openingBalancePaise: 0,
        auditPdfUrl: "",
      });
      expect(parsed.success, label).toBe(false);
    }
  });

  it("tells the treasurer what a year looks like rather than just rejecting it", () => {
    const parsed = FINANCIAL_YEAR_SCHEMA.safeParse({
      label: "2026-28",
      openingBalancePaise: 0,
      auditPdfUrl: "",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toMatch(/1 April to 31 March/);
  });

  it("refuses an opening balance that is negative or finer than a paisa", () => {
    for (const openingBalancePaise of [-1, 1.5, Number.NaN]) {
      expect(
        FINANCIAL_YEAR_SCHEMA.safeParse({
          label: "2026-27",
          openingBalancePaise,
          auditPdfUrl: "",
        }).success,
        String(openingBalancePaise),
      ).toBe(false);
    }
  });

  it("takes no audit report as an empty field, and a real one as an address", () => {
    expect(
      FINANCIAL_YEAR_SCHEMA.safeParse({
        label: "2026-27",
        openingBalancePaise: 100,
        auditPdfUrl: "https://example.test/audit.pdf",
      }).success,
    ).toBe(true);
    expect(
      FINANCIAL_YEAR_SCHEMA.safeParse({
        label: "2026-27",
        openingBalancePaise: 100,
        auditPdfUrl: "audit.pdf",
      }).success,
    ).toBe(false);
  });
});

describe("UNLOCK_REASON_SCHEMA", () => {
  it("will not reopen a year on an empty excuse", () => {
    expect(UNLOCK_REASON_SCHEMA.safeParse({ reason: "   " }).success).toBe(false);
    expect(UNLOCK_REASON_SCHEMA.safeParse({ reason: "typo" }).success).toBe(false);
  });

  it("keeps a sentence that says what went wrong", () => {
    const parsed = UNLOCK_REASON_SCHEMA.safeParse({
      reason: "A voucher was entered against the wrong date.",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("yearsOverlap", () => {
  it("refuses to open the same year twice", () => {
    expect(yearsOverlap(YEAR, YEAR)).toBe(true);
  });

  it("refuses a window that cuts into a year already kept", () => {
    expect(yearsOverlap(YEAR, { startDate: "2026-05-01", endDate: "2027-08-31" })).toBe(true);
    expect(yearsOverlap(YEAR, { startDate: "2025-12-01", endDate: "2026-04-01" })).toBe(true);
  });

  it("allows two years that only touch at the boundary", () => {
    expect(yearsOverlap(YEAR, { startDate: "2027-04-01", endDate: "2028-03-31" })).toBe(false);
    expect(yearsOverlap(YEAR, { startDate: "2025-04-01", endDate: "2026-03-31" })).toBe(false);
  });
});

/** §9: a locked year answers 409 with the lock date and who locked it. */
describe("lockMessage", () => {
  it("names the treasurer, the day, and what to do about it", () => {
    const message = lockMessage(yearDoc(), "Test Treasurer");
    expect(message).toContain("Test Treasurer");
    expect(message).toContain("24 September 2026");
    expect(message.toLowerCase()).toContain("closed");
  });

  it("says the day the branch saw, not the day the server's clock saw", () => {
    // Closed at half past midnight in Mizoram. Read back as an instant this is
    // still the previous evening in UTC, and a treasurer told the year shut on
    // the wrong day stops trusting the message.
    const justAfterMidnight = yearDoc({ lockedAt: new Date("2026-09-25T00:30:00+05:30") });
    expect(lockMessage(justAfterMidnight, "Test Treasurer")).toContain("25 September 2026");
  });

  it("copes with an account that has since left the site", () => {
    const message = lockMessage(yearDoc(), null);
    expect(message).not.toContain("null");
    expect(message).toContain("the office-bearer who closed it");
  });
});

/** §10's fixture ledger: one contribution in, one event paid out. */
const rows = [
  { type: "income", category: "donation", amountPaise: 50000000 },
  { type: "expense", category: "event", amountPaise: 12500000 },
] as const satisfies readonly LedgerRow[];

/**
 * The treasurer's list of years: each one's own four figures beside its lock
 * state, so the screen that opens a year also shows whether it has anything in it.
 */
describe("toAdminYearRow", () => {
  it("walks the year's own vouchers out of its opening balance", () => {
    // §10's fixture ledger: ₹25,000 opened, ₹5,00,000 in, ₹1,25,000 out,
    // ₹4,00,000 closing — the same arithmetic the public page prints.
    const row = toAdminYearRow(yearDoc({ openingBalancePaise: 2500000 }), rows);
    expect(row).toMatchObject({
      label: "2026-27",
      openingBalancePaise: 2500000,
      incomePaise: 50000000,
      expensePaise: 12500000,
      closingPaise: 40000000,
      entryCount: 2,
    });
  });

  it("counts the vouchers so a year that cannot be deleted says why on its row", () => {
    // The API refuses to delete a year with entries in it (§9); the count is what
    // lets the screen say that before the treasurer has to be refused.
    expect(toAdminYearRow(yearDoc(), rows).entryCount).toBe(2);
    expect(toAdminYearRow(yearDoc(), []).entryCount).toBe(0);
  });

  it("carries the lock state and the day it was closed", () => {
    const closed = toAdminYearRow(yearDoc(), []);
    expect(closed.locked).toBe(true);
    expect(closed.lockedOn).toBe("2026-09-24");
    expect(toAdminYearRow(yearDoc({ locked: false, lockedAt: undefined }), []).lockedOn).toBeNull();
  });

  it("keeps the reason a closed year was reopened", () => {
    // The sentence belongs on the row: a figure that became changeable again is
    // the thing a reader of the published accounts will ask about.
    const row = toAdminYearRow(yearDoc({ unlockReason: "The audit asked for one line moved." }), []);
    expect(row.unlockReason).toBe("The audit asked for one line moved.");
  });
});

/**
 * One year's page, decided from what the reads returned rather than from what
 * they threw — the same three-state rule the public pages follow (§9).
 */
describe("toAdminYearPage", () => {
  it("gives the screen the year, its vouchers and its breakdown", () => {
    const page = toAdminYearPage(yearDoc({ locked: false }), rows);
    if (page.state !== "ready") throw new Error("expected a ready page");
    expect(page.year.label).toBe("2026-27");
    expect(page.year.locked).toBe(false);
    expect(page.entryCount).toBe(2);
    expect(page.expense.map((total) => total.label)).toEqual(["Events"]);
    expect(page.lockMessage).toBeNull();
  });

  it("gives a closed year the sentence that says who shut it and when", () => {
    // So the treasurer learns the year cannot take a voucher before the API has
    // to refuse the entry, and learns whose decision it was rather than guesswork.
    const page = toAdminYearPage(yearDoc(), [], "Test Treasurer");
    if (page.state !== "ready") throw new Error("expected a ready page");
    expect(page.year.locked).toBe(true);
    expect(page.lockMessage).toContain("Test Treasurer");
    expect(page.lockMessage).toContain("24 September 2026");
  });

  it("says the figures could not be read when the ledger would not answer", () => {
    const page = toAdminYearPage(yearDoc(), null);
    expect(page).toEqual({ state: "unavailable", year: expect.objectContaining({ label: "2026-27" }) });
    // A screen that carried on with an empty list would be a screen publishing a
    // closed year with nothing in it.
    expect("entryCount" in page).toBe(false);
  });

  it("has no page at all when the year was not found", () => {
    expect(toAdminYearPage(null, [])).toEqual({ state: "missing" });
  });
});

/**
 * A contribution is income in the year its date falls under, so a screen that
 * asks for a date has to say which years will refuse one (§8).
 */
describe("closedLabelsOf", () => {
  it("names the years a voucher cannot be entered against", () => {
    const labels = closedLabelsOf([
      yearDoc({ label: "2026-27", locked: true }),
      yearDoc({ label: "2027-28", locked: false, lockedAt: undefined }),
    ]);
    expect(labels).toEqual(["2026-27"]);
  });

  it("says nothing when every year still takes vouchers", () => {
    expect(closedLabelsOf([yearDoc({ locked: false })])).toEqual([]);
  });
});

/** The other half of the same sentence: which years will take the entry. */
describe("openLabelsOf", () => {
  it("names the years a voucher can still be entered against", () => {
    const labels = openLabelsOf([
      yearDoc({ label: "2026-27", locked: true }),
      yearDoc({ label: "2027-28", locked: false, lockedAt: undefined }),
    ]);
    expect(labels).toEqual(["2027-28"]);
  });

  it("says nothing when every year stands closed", () => {
    expect(openLabelsOf([yearDoc({ label: "2026-27" })])).toEqual([]);
  });
});

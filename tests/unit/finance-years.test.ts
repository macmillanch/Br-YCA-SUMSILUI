import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { lockMessage, yearsOverlap } from "@/lib/finance";
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

import { describe, expect, it } from "vitest";
import {
  currentFiscalYear,
  fiscalYearFromLabel,
  fiscalYearOf,
  isInFiscalYear,
  sameFiscalYear,
} from "@/lib/fiscal-year";

describe("fiscalYearOf", () => {
  it("puts an April date in the year that starts that April", () => {
    expect(fiscalYearOf("2026-04-01")).toEqual({
      label: "2026-27",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
    });
  });

  it("puts a March date in the previous year bracket", () => {
    expect(fiscalYearOf("2026-03-31").label).toBe("2025-26");
  });

  it("handles the last day before a fiscal year rolls over", () => {
    expect(fiscalYearOf("2027-03-31").label).toBe("2026-27");
    expect(fiscalYearOf("2027-04-01").label).toBe("2027-28");
  });

  it("handles a leap-day date", () => {
    expect(fiscalYearOf("2028-02-29").label).toBe("2027-28");
  });

  it("rejects non-ISO and impossible dates rather than guessing", () => {
    expect(() => fiscalYearOf("01/04/2026")).toThrow(TypeError);
    expect(() => fiscalYearOf("01-04-2026")).toThrow(TypeError);
    expect(() => fiscalYearOf("2026-13-01")).toThrow(TypeError);
    expect(() => fiscalYearOf("2026-02-30")).toThrow(TypeError);
  });
});

describe("currentFiscalYear", () => {
  it("derives the bracket from a supplied date", () => {
    expect(currentFiscalYear(new Date("2026-09-24T00:00:00Z")).label).toBe("2026-27");
    expect(currentFiscalYear(new Date("2026-01-05T00:00:00Z")).label).toBe("2025-26");
  });
});

describe("isInFiscalYear", () => {
  const year = fiscalYearOf("2026-09-24");

  it("includes both endpoints", () => {
    expect(isInFiscalYear("2026-04-01", year)).toBe(true);
    expect(isInFiscalYear("2027-03-31", year)).toBe(true);
  });

  it("excludes the day before and the day after", () => {
    expect(isInFiscalYear("2026-03-31", year)).toBe(false);
    expect(isInFiscalYear("2027-04-01", year)).toBe(false);
  });
});

describe("fiscalYearFromLabel", () => {
  it("round-trips a label back to its span", () => {
    expect(fiscalYearFromLabel("2026-27")).toEqual({
      label: "2026-27",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
    });
  });

  it("rejects a label that is not 1 April to 31 March", () => {
    expect(() => fiscalYearFromLabel("2026-28")).toThrow(RangeError);
    expect(() => fiscalYearFromLabel("2026")).toThrow(TypeError);
  });
});

describe("sameFiscalYear", () => {
  it("groups dates either side of a year boundary", () => {
    expect(sameFiscalYear("2026-12-31", "2027-01-01")).toBe(true);
    expect(sameFiscalYear("2027-03-31", "2027-04-01")).toBe(false);
  });
});

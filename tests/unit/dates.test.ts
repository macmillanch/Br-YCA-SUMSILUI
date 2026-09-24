import { describe, expect, it } from "vitest";
import { isCalendarDate, istCalendarDate, longDate, shortDate } from "@/lib/dates";

describe("istCalendarDate", () => {
  it("reads an instant as the day the branch sees it", () => {
    // 18:30 UTC is 00:00 the following morning in India.
    expect(istCalendarDate(new Date("2026-09-24T18:30:00Z"))).toBe("2026-09-25");
    expect(istCalendarDate(new Date("2026-09-24T18:29:00Z"))).toBe("2026-09-24");
  });

  it("can move a date across a fiscal-year boundary", () => {
    expect(istCalendarDate(new Date("2026-03-31T18:30:00Z"))).toBe("2026-04-01");
  });
});

describe("isCalendarDate", () => {
  it("accepts a real day and rejects the rest", () => {
    expect(isCalendarDate("2026-09-24")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("24-09-2026")).toBe(false);
    expect(isCalendarDate("2026-9-24")).toBe(false);
    expect(isCalendarDate("")).toBe(false);
  });
});

describe("shortDate and longDate", () => {
  it("format a calendar day without shifting it", () => {
    // en-IN abbreviates September to "Sept", which is how Indian newspapers
    // write it; the rest of the site is en-IN, so the dates follow.
    expect(shortDate("2026-09-24")).toBe("24 Sept 2026");
    expect(longDate("2026-09-24")).toBe("24 September 2026");
  });
});

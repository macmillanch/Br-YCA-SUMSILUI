import { describe, expect, it } from "vitest";
import { barFraction, formatShortPaise, niceScaleMax } from "@/lib/charts";

/**
 * A bar is a figure drawn as a width, and the two ways it fails are the same
 * way: a divide by zero, and a width that runs off the page. The geometry here
 * is deliberately tiny and dependency-free so that a public page can carry a
 * chart without a chart library's JavaScript (§5's table below every chart is
 * still the exact figures; these labels are only the short form).
 */

describe("niceScaleMax", () => {
  it("stays positive when every value is zero", () => {
    expect(niceScaleMax([0, 0])).toBeGreaterThan(0);
    expect(niceScaleMax([])).toBeGreaterThan(0);
    expect(niceScaleMax([-250000])).toBeGreaterThan(0);
  });

  it("rounds up to a head the reader can say", () => {
    expect(niceScaleMax([0, 999999])).toBe(1000000);
    expect(niceScaleMax([0, 1250000])).toBe(2000000);
    expect(niceScaleMax([0, 2500000])).toBe(2500000);
    expect(niceScaleMax([0, 12500000])).toBe(20000000);
  });

  it("never cuts a bar short", () => {
    for (const value of [1, 99, 101, 4_999_999, 12_345_678, 999_999_999]) {
      expect(niceScaleMax([value])).toBeGreaterThanOrEqual(value);
    }
  });
});

describe("barFraction", () => {
  it("is the share of the scale a value takes up", () => {
    expect(barFraction(5000000, 10000000)).toBeCloseTo(0.5, 9);
  });

  it("stays inside the picture however large the value is", () => {
    expect(barFraction(50000000, 10000000)).toBe(1);
    expect(barFraction(-5000000, 10000000)).toBe(0);
  });

  it("is zero rather than infinite when the scale is zero", () => {
    expect(barFraction(1000000, 0)).toBe(0);
    expect(barFraction(0, 0)).toBe(0);
  });
});

describe("formatShortPaise", () => {
  it("prints up to ₹99,999.99 in full", () => {
    expect(formatShortPaise(0)).toBe("₹0");
    expect(formatShortPaise(999999)).toBe("₹9,999.99");
    expect(formatShortPaise(9999999)).toBe("₹99,999.99");
  });

  it("switches to lakh and crore where a reader would", () => {
    expect(formatShortPaise(10000000)).toBe("₹1.0 lakh");
    expect(formatShortPaise(100000000)).toBe("₹10.0 lakh");
    expect(formatShortPaise(1250000000)).toBe("₹1.25 crore");
    expect(formatShortPaise(1000000000)).toBe("₹1.0 crore");
  });

  it("keeps the sign of a figure that is below zero", () => {
    expect(formatShortPaise(-10000000)).toBe("-₹1.0 lakh");
  });

  it("never prints NaN", () => {
    for (const paise of [0, 1, 999999, 10000000, 1250000000, -1250000000]) {
      expect(formatShortPaise(paise)).not.toContain("NaN");
    }
  });
});

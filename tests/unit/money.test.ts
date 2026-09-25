import { describe, expect, it } from "vitest";
import {
  PAISE_PER_RUPEE,
  formatPaise,
  paiseToRupees,
  paiseToRupeesInput,
  rupeesInputToPaise,
  rupeesToPaise,
  sumPaise,
} from "@/lib/money";

describe("formatPaise", () => {
  it("drops the fraction for whole rupees", () => {
    expect(formatPaise(125000)).toBe("₹1,250");
  });

  it("keeps two sub-rupee digits", () => {
    expect(formatPaise(125050)).toBe("₹1,250.50");
    expect(formatPaise(5)).toBe("₹0.05");
  });

  it("uses Indian digit grouping", () => {
    expect(formatPaise(1234567890)).toBe("₹1,23,45,678.90");
    expect(formatPaise(100000)).toBe("₹1,000");
    expect(formatPaise(10000000)).toBe("₹1,00,000");
  });

  it("handles zero and large values", () => {
    expect(formatPaise(0)).toBe("₹0");
    expect(formatPaise(999999999999)).toBe("₹9,99,99,99,999.99");
  });

  it("signs a deficit before the rupee symbol", () => {
    expect(formatPaise(-25000)).toBe("-₹250");
  });

  it("rejects fractional paise instead of silently rounding", () => {
    expect(() => formatPaise(1250.5)).toThrow(TypeError);
  });
});

describe("paise and rupees", () => {
  it("converts both ways", () => {
    expect(paiseToRupees(125050)).toBe(1250.5);
    expect(rupeesToPaise(1250.5)).toBe(125050);
    expect(PAISE_PER_RUPEE).toBe(100);
  });

  it("refuses a rupee value finer than one paisa", () => {
    expect(() => rupeesToPaise(1.005)).toThrow(RangeError);
  });
});

describe("sumPaise", () => {
  it("adds an empty ledger to zero", () => {
    expect(sumPaise([])).toBe(0);
  });

  it("stays exact where floats would drift", () => {
    expect(sumPaise([10050, 10050, 10050])).toBe(30150);
  });

  it("nets income against expense", () => {
    expect(sumPaise([500000, -120000])).toBe(380000);
  });
});

/**
 * Every finance form asks for rupees, because that is how a voucher is written,
 * and the database only ever holds paise. These two are the whole bridge, so
 * the cases a treasurer can actually type are tested here rather than in a
 * screen that would show a wrong amount with a straight face.
 */
describe("rupeesInputToPaise", () => {
  it("reads a whole-rupee amount", () => {
    expect(rupeesInputToPaise("2500")).toBe(250000);
  });

  it("reads paise typed as a decimal", () => {
    expect(rupeesInputToPaise("1250.5")).toBe(125050);
    expect(rupeesInputToPaise("0.05")).toBe(5);
  });

  it("reads the commas an order is written with", () => {
    expect(rupeesInputToPaise("2,50,000.50")).toBe(25000050);
  });

  it("treats a blank field as nothing entered, not as zero", () => {
    expect(rupeesInputToPaise("")).toBeNull();
    expect(rupeesInputToPaise("   ")).toBeNull();
  });

  it("refuses an amount finer than one paisa", () => {
    expect(rupeesInputToPaise("1.005")).toBeNull();
  });

  it("refuses a negative, a letter and a shorthand figure", () => {
    expect(rupeesInputToPaise("-5")).toBeNull();
    expect(rupeesInputToPaise("abc")).toBeNull();
    expect(rupeesInputToPaise("1e5")).toBeNull();
    expect(rupeesInputToPaise("NaN")).toBeNull();
  });

  it("refuses a trailing dot, which says nothing about the paise", () => {
    expect(rupeesInputToPaise("250.")).toBeNull();
  });
});

describe("paiseToRupeesInput", () => {
  it("leaves an unrecorded amount blank", () => {
    expect(paiseToRupeesInput(0)).toBe("");
  });

  it("drops a fraction nobody paid", () => {
    expect(paiseToRupeesInput(250000)).toBe("2500");
  });

  it("keeps two sub-rupee digits", () => {
    expect(paiseToRupeesInput(125050)).toBe("1250.50");
    expect(paiseToRupeesInput(5)).toBe("0.05");
  });

  it("hands back what it was given", () => {
    for (const paise of [1, 5, 99, 100, 125050, 25000050, 999999999999]) {
      expect(rupeesInputToPaise(paiseToRupeesInput(paise))).toBe(paise);
    }
  });
});

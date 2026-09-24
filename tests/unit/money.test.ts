import { describe, expect, it } from "vitest";
import {
  PAISE_PER_RUPEE,
  formatPaise,
  paiseToRupees,
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

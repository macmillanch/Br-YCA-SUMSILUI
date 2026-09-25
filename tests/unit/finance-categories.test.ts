import { describe, expect, it } from "vitest";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  categoriesOf,
  categoryLabel,
  isValidCategory,
} from "@/lib/finance-categories";

/**
 * The category list is fixed rather than free text for one reason: a chart of
 * where the money went is only comparable to last year's if both years wrote
 * under the same heads. A treasurer typing "Road repair" as a category would
 * make every year's breakdown a different question.
 */
describe("the heads money comes in under", () => {
  it("are exactly the ones the branch agreed to keep", () => {
    expect(INCOME_CATEGORIES).toEqual([
      "subscription",
      "donation",
      "event_collection",
      "grant",
      "interest",
      "other_income",
    ]);
  });

  it("are exactly the ones it agreed to spend under", () => {
    expect(EXPENSE_CATEGORIES).toEqual([
      "event",
      "community_welfare",
      "education",
      "youth",
      "administration",
      "maintenance",
      "relief",
      "other_expense",
    ]);
  });

  it("share no head between the two directions", () => {
    for (const income of INCOME_CATEGORIES) {
      expect(EXPENSE_CATEGORIES).not.toContain(income);
    }
  });
});

describe("categoriesOf", () => {
  it("offers only what can be received", () => {
    expect(categoriesOf("income")).toEqual([...INCOME_CATEGORIES]);
  });

  it("offers only what can be spent", () => {
    expect(categoriesOf("expense")).toEqual([...EXPENSE_CATEGORIES]);
  });
});

describe("isValidCategory", () => {
  it("refuses a head from the wrong side of the ledger", () => {
    expect(isValidCategory("income", "event")).toBe(false);
    expect(isValidCategory("expense", "donation")).toBe(false);
  });

  it("accepts a head typed on its own side", () => {
    expect(isValidCategory("income", "grant")).toBe(true);
    expect(isValidCategory("expense", "community_welfare")).toBe(true);
  });
});

describe("categoryLabel", () => {
  it("reads as a phrase a member would recognise", () => {
    expect(categoryLabel("event_collection")).toBe("Event collections");
    expect(categoryLabel("community_welfare")).toBe("Community welfare");
  });

  it("never returns the raw key", () => {
    for (const category of [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]) {
      const label = categoryLabel(category);
      expect(label).not.toBe(category);
      expect(label).not.toContain("_");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

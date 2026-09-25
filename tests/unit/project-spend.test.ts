import { describe, expect, it } from "vitest";
import {
  SPEND_UNREADABLE,
  isOverspent,
  shareBarWidth,
  shareCaption,
  spendLine,
} from "@/lib/project-spend";

/**
 * What the three screens that show a work print beside each other, kept as
 * functions so the wording is decided once. A card, a detail page and an office
 * screen that each wrote their own sentence about money would eventually print
 * three different things about one set of accounts.
 */

const TWO_LAKH = 25000000; // ₹2,50,000 in paise

describe("spendLine", () => {
  it("says zero of the sanctioned amount when the ledger has been read and is empty", () => {
    // A clean zero is a fact worth publishing: it says the accounts were looked
    // at and nobody has drawn against the work.
    expect(spendLine(0, TWO_LAKH)).toBe("₹0 of ₹2,50,000");
  });

  it("names the sanctioned amount the spend is a share of", () => {
    expect(spendLine(12500000, TWO_LAKH)).toBe("₹1,25,000 of ₹2,50,000");
  });

  it("prints the spend alone when nothing was sanctioned to be a share of", () => {
    // "₹5,000 of ₹0" would be a sentence about a sanction that does not exist.
    expect(spendLine(500000, 0)).toBe("₹5,000");
    expect(spendLine(0, 0)).toBe("₹0");
  });

  it("says the figures could not be read instead of printing ₹0", () => {
    // ₹0 would be a claim about the accounts that nobody has checked.
    expect(spendLine(null, TWO_LAKH)).toBe(SPEND_UNREADABLE);
    expect(spendLine(null, 0)).toBe(SPEND_UNREADABLE);
  });
});

describe("isOverspent", () => {
  it("is true only past the sanctioned amount", () => {
    expect(isOverspent(125)).toBe(true);
    expect(isOverspent(100)).toBe(false);
    expect(isOverspent(0)).toBe(false);
    // Nothing sanctioned means no share to pass, so nothing to sound the alarm on.
    expect(isOverspent(null)).toBe(false);
  });
});

describe("shareBarWidth", () => {  it("draws the share it is given", () => {
    expect(shareBarWidth(60)).toBe(60);
    expect(shareBarWidth(0)).toBe(0);
  });

  it("never draws past full when the branch overspent", () => {
    // The bar stops at the edge of the budget; the caption still prints 125%.
    expect(shareBarWidth(125)).toBe(100);
    expect(shareBarWidth(100)).toBe(100);
  });

  it("draws nothing when there is no share to draw", () => {
    expect(shareBarWidth(null)).toBeNull();
  });
});

describe("shareCaption", () => {
  it("states the share in whole percentages", () => {
    expect(shareCaption(0)).toBe("0% of the sanctioned amount");
    expect(shareCaption(60)).toBe("60% of the sanctioned amount");
    expect(shareCaption(33.333333)).toBe("33% of the sanctioned amount");
  });

  it("says plainly when the work has cost more than was sanctioned", () => {
    expect(shareCaption(125)).toBe(
      "125% of the sanctioned amount — the branch has spent more than it sanctioned",
    );
  });

  it("does not call a fully spent work an overspend", () => {
    expect(shareCaption(100)).toBe("100% of the sanctioned amount");
  });

  it("says nothing when nothing was sanctioned", () => {
    expect(shareCaption(null)).toBeNull();
  });
});

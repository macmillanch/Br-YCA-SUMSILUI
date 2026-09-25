import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  BLANK_VOUCHER,
  voucherBodyOf,
  voucherValuesOf,
  type VoucherValues,
} from "@/lib/voucher-form";
import type { AdminTransaction } from "@/lib/finance";

/**
 * The voucher form's arithmetic, apart from the fields that draw it — the same
 * division the donation form keeps, because a rupee typed one paise wrong is a
 * figure the public reads wrong.
 */

const YEAR_ID = new ObjectId();

function values(over: Partial<VoucherValues> = {}): VoucherValues {
  return {
    ...BLANK_VOUCHER,
    date: "2026-09-15",
    type: "expense",
    category: "event",
    description: "Cultural programme sound system",
    amountRupees: "12500",
    voucherNo: "V-041",
    party: "Sumsilui Cultural Committee",
    ...over,
  };
}

function row(over: Partial<AdminTransaction> = {}): AdminTransaction {
  return {
    id: YEAR_ID.toHexString(),
    yearId: YEAR_ID.toHexString(),
    date: "2026-09-15",
    type: "expense",
    category: "event",
    categoryLabel: "Events",
    description: "Cultural programme sound system",
    amountPaise: 1250000,
    voucherNo: "V-041",
    party: "Sumsilui Cultural Committee",
    projectId: null,
    projectName: null,
    enteredByName: "Test Treasurer",
    revisions: [],
    ...over,
  };
}

describe("voucherBodyOf", () => {
  it("sends a rupee figure as whole paise, commas and all", () => {
    const prepared = voucherBodyOf(values({ amountRupees: "12,500" }));

    expect(prepared.ok).toBe(true);
    if (prepared.ok) expect(prepared.body.amountPaise).toBe(1250000);
  });

  it("refuses an amount that is not a figure, and says which box", () => {
    expect(voucherBodyOf(values({ amountRupees: "1e5" }))).toEqual({
      ok: false,
      fieldErrors: {
        amountPaise: "Write the amount in whole rupees, or with paise as a decimal.",
      },
    });
  });

  it("leaves every other field exactly as it was typed, for the schema to refuse", () => {
    const prepared = voucherBodyOf(values({ description: "", category: "" }));

    if (!prepared.ok) throw new Error("the figure itself was valid");
    expect(prepared.body).toEqual({
      date: "2026-09-15",
      type: "expense",
      category: "",
      description: "",
      amountPaise: 1250000,
      voucherNo: "V-041",
      party: "Sumsilui Cultural Committee",
      projectId: "",
    });
  });
});

describe("voucherValuesOf", () => {
  it("puts a saved voucher back into the form", () => {
    expect(voucherValuesOf(row())).toEqual(values());
  });

  it("shows a voucher that names no work as no work", () => {
    expect(voucherValuesOf(row({ projectId: null })).projectId).toBe("");
  });

  it("keeps a work's id so a correction does not quietly drop it", () => {
    const id = new ObjectId().toHexString();

    expect(voucherValuesOf(row({ projectId: id })).projectId).toBe(id);
  });
});

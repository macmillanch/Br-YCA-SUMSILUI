import { describe, expect, it } from "vitest";
import {
  BLANK_DONATION,
  donationBodyOf,
  donationValuesOf,
  type DonationValues,
} from "@/lib/donation-form";
import type { AdminDonation } from "@/lib/donations";

/**
 * The contribution form's own arithmetic, kept apart from the fields that draw it.
 *
 * What is tested here is the one step a browser cannot be trusted with: a
 * treasurer types rupees, and the ledger keeps paise. A figure that slips
 * through as `2,500` or `2.5.1` would be a figure the published accounts then
 * carry, so the form refuses it before anything is sent.
 */

function values(over: Partial<DonationValues> = {}): DonationValues {
  return {
    ...BLANK_DONATION,
    date: "2026-04-12",
    donorName: "Sri Chakma Welfare Board",
    purpose: "Towards the annual cultural meet",
    amountRupees: "500000",
    voucherNo: "DON-001",
    acknowledgePublicly: true,
    ...over,
  };
}

function row(over: Partial<AdminDonation> = {}): AdminDonation {
  return {
    id: "donation-id",
    date: "2026-04-12",
    donorName: "Sri Chakma Welfare Board",
    purpose: "Towards the annual cultural meet",
    amountPaise: 50000000,
    acknowledgePublicly: true,
    voucherNo: "DON-001",
    ...over,
  };
}

describe("donationBodyOf", () => {
  it("sends a rupee figure as whole paise, commas and all", () => {
    const prepared = donationBodyOf(values({ amountRupees: "2,500" }));

    expect(prepared.ok).toBe(true);
    if (prepared.ok) expect(prepared.body.amountPaise).toBe(250000);
  });

  it("keeps paise when the treasurer writes them as a decimal", () => {
    const prepared = donationBodyOf(values({ amountRupees: "2500.50" }));

    expect(prepared.ok).toBe(true);
    if (prepared.ok) expect(prepared.body.amountPaise).toBe(250050);
  });

  it("refuses an amount that is not a figure, and says which box", () => {
    expect(donationBodyOf(values({ amountRupees: "five thousand" }))).toEqual({
      ok: false,
      fieldErrors: {
        amountPaise: "Write the amount in whole rupees, or with paise as a decimal.",
      },
    });
  });

  it("passes the donor's own answer about publishing the name", () => {
    const kept = donationBodyOf(values({ acknowledgePublicly: true }));
    const withheld = donationBodyOf(values({ acknowledgePublicly: false }));

    if (!kept.ok || !withheld.ok) throw new Error("the figures should have been accepted");
    expect(kept.body.acknowledgePublicly).toBe(true);
    expect(withheld.body.acknowledgePublicly).toBe(false);
  });

  it("sends nothing about the voucher beyond the paper reference", () => {
    const prepared = donationBodyOf(values());

    if (!prepared.ok) throw new Error("the figures should have been accepted");
    expect(Object.keys(prepared.body).sort()).toEqual([
      "acknowledgePublicly",
      "amountPaise",
      "date",
      "donorName",
      "purpose",
      "voucherNo",
    ]);
  });
});

describe("donationValuesOf", () => {
  it("puts a saved contribution back into the form, rupees and all", () => {
    expect(donationValuesOf(row())).toEqual(values());
  });

  it("leaves the amount blank rather than showing a published name as a figure", () => {
    expect(donationValuesOf(row({ amountPaise: 0 })).amountRupees).toBe("");
  });

  it("carries the voucher number so a correction does not lose the paper reference", () => {
    expect(donationValuesOf(row({ voucherNo: null })).voucherNo).toBe("");
  });
});

import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import {
  DONATION_VISIBILITY_FILTER,
  buildDonationDoc,
  donationTransactionInput,
  donationsPageOf,
  editDonation,
  removeDonation,
  saveDonation,
  toAcknowledgedDonation,
  toAdminDonation,
  type DonationStores,
} from "@/lib/donations";
import {
  DONATION_EDIT_SCHEMA,
  DONATION_SCHEMA,
  type DonationInput,
} from "@/lib/validation/donations";
import type { DonationDoc, FinancialYearDoc, TransactionDoc } from "@/lib/types";

/**
 * A contribution is two records that must never disagree: the name the branch is
 * happy to print, and the income voucher that makes the figure true in the
 * published accounts (§6). Everything here is about keeping them paired — one
 * write that fails means neither stands, and one edit means both change.
 *
 * Atlas M0 offers no replica set, so a database transaction cannot span the two
 * collections. The seam is therefore the two writes themselves, which is what
 * lets the rollback be asserted rather than described.
 */

const VOUCHER = new ObjectId();
const DONATION = new ObjectId();
const TREASURER = new ObjectId();

/** Only the year's name matters to these tests; `lockMessage` is another module's business. */
const A_YEAR = { label: "2026-27" } as FinancialYearDoc;

function input(over: Partial<DonationInput> = {}): DonationInput {
  return {
    date: "2026-04-12",
    donorName: "Sri Chakma Welfare Board",
    purpose: "Towards the annual cultural meet",
    amountPaise: 50000000,
    voucherNo: "DON-001",
    acknowledgePublicly: true,
    ...over,
  };
}

function voucher(over: Partial<TransactionDoc> = {}): TransactionDoc {
  return {
    _id: VOUCHER,
    yearId: new ObjectId(),
    date: "2026-04-12",
    type: "income",
    category: "donation",
    description: "Towards the annual cultural meet",
    amountPaise: 50000000,
    voucherNo: "DON-001",
    party: "Sri Chakma Welfare Board",
    entryById: TREASURER,
    revisions: [],
    createdAt: new Date("2026-04-12T04:00:00Z"),
    updatedAt: new Date("2026-04-12T04:00:00Z"),
    ...over,
  };
}

function donationDoc(): DonationDoc {
  return buildDonationDoc(input(), VOUCHER, TREASURER, new Date("2026-04-12T04:00:00Z"));
}

/**
 * A pair of collections that answers however a test asks, and records every call
 * in the order it came — including a test's own override, which is how the
 * sequence of a write across two collections can be read back.
 */
function stores(over: Partial<DonationStores> = {}) {
  const calls: string[] = [];
  const defaultStores: DonationStores = {
    insertTransaction: async () => ({ result: "written", transaction: voucher() }),
    replaceTransaction: async () => ({ result: "written", transaction: voucher() }),
    deleteTransaction: async () => undefined,
    findDonation: async () => null,
    insertDonation: async () => undefined,
    replaceDonation: async () => true,
    deleteDonation: async () => true,
  };
  const merged: DonationStores = { ...defaultStores, ...over };

  const fake = Object.fromEntries(
    Object.entries(merged).map(([name, method]) => [
      name,
      async (...args: unknown[]) => {
        calls.push(name);
        return (method as (...values: unknown[]) => unknown)(...args);
      },
    ]),
  ) as unknown as DonationStores;

  return { fake, calls };
}

describe("DONATION_SCHEMA", () => {
  it("takes a contribution written the way the office writes one", () => {
    expect(DONATION_SCHEMA.safeParse(input()).success).toBe(true);
  });

  it("publishes no name when the donor's answer is missing from the form", () => {
    const { acknowledgePublicly, ...noAnswer } = input();

    expect(acknowledgePublicly).toBe(true);
    expect(DONATION_SCHEMA.parse(noAnswer).acknowledgePublicly).toBe(false);
  });

  it("refuses a day written the way people say it and a figure of nothing", () => {
    expect(DONATION_SCHEMA.safeParse(input({ date: "12/04/2026" })).success).toBe(false);
    expect(DONATION_SCHEMA.safeParse(input({ amountPaise: 0 })).success).toBe(false);
  });
});

describe("DONATION_EDIT_SCHEMA", () => {
  it("will not change an acknowledgement without a sentence saying why", () => {
    expect(DONATION_EDIT_SCHEMA.safeParse({ ...input(), reason: "typo" }).success).toBe(false);
    expect(
      DONATION_EDIT_SCHEMA.safeParse({
        ...input(),
        reason: "The donor asked that their name be shown.",
      }).success,
    ).toBe(true);
  });
});

describe("donationTransactionInput", () => {
  it("is the income voucher that makes the acknowledgement true", () => {
    expect(donationTransactionInput(input())).toEqual({
      date: "2026-04-12",
      type: "income",
      category: "donation",
      description: "Towards the annual cultural meet",
      amountPaise: 50000000,
      voucherNo: "DON-001",
      party: "Sri Chakma Welfare Board",
      projectId: "",
    });
  });

  it("writes what the money was for in the description and who gave it in the party", () => {
    const transaction = donationTransactionInput(input({ donorName: "A well-wisher" }));

    expect(transaction.description).toBe("Towards the annual cultural meet");
    expect(transaction.party).toBe("A well-wisher");
  });

  it("files a contribution under no work, because a gift is not a work's spending", () => {
    expect(donationTransactionInput(input()).projectId).toBe("");
  });

  it("keeps a donor's name out of the ledger until they agree to appear in it", () => {
    // The published ledger prints each entry's party, and the year's download
    // carries that column out of the site. A name the donor never offered would
    // reach the world through the accounts while the thanks page said nothing.
    expect(
      donationTransactionInput(input({ acknowledgePublicly: false })).party,
    ).toBe("Contribution (name with the Treasurer)");
    expect(donationTransactionInput(input({ acknowledgePublicly: true })).party).toBe(
      "Sri Chakma Welfare Board",
    );
  });
});

describe("buildDonationDoc", () => {
  const now = new Date("2026-04-12T04:00:00Z");

  it("names the voucher it belongs to, and no other", () => {
    const doc = buildDonationDoc(input(), VOUCHER, TREASURER, now);

    expect(doc.transactionId).toBe(VOUCHER);
    expect(doc.recordedById).toBe(TREASURER);
    expect(doc.donorName).toBe("Sri Chakma Welfare Board");
    expect(doc.createdAt).toBe(now);
  });

  it("carries the donor's own answer about publishing their name, either way", () => {
    expect(buildDonationDoc(input(), VOUCHER, TREASURER, now).acknowledgePublicly).toBe(true);
    expect(
      buildDonationDoc(input({ acknowledgePublicly: false }), VOUCHER, TREASURER, now)
        .acknowledgePublicly,
    ).toBe(false);
  });
});

describe("toAcknowledgedDonation", () => {
  it("offers a name, a purpose, a figure and a day, and nothing else", () => {
    const publicEntry = toAcknowledgedDonation({ ...donationDoc(), _id: DONATION });

    expect(publicEntry).toEqual({
      donorName: "Sri Chakma Welfare Board",
      amountPaise: 50000000,
      date: "2026-04-12",
      purpose: "Towards the annual cultural meet",
    });
    expect(publicEntry).not.toHaveProperty("transactionId");
    expect(publicEntry).not.toHaveProperty("recordedById");
  });
});

describe("toAdminDonation", () => {
  it("carries the id a form posts back, and keeps the record's own links off the wire", () => {
    expect(toAdminDonation({ ...donationDoc(), _id: DONATION }, "DON-001")).toEqual({
      id: DONATION.toHexString(),
      date: "2026-04-12",
      donorName: "Sri Chakma Welfare Board",
      purpose: "Towards the annual cultural meet",
      amountPaise: 50000000,
      acknowledgePublicly: true,
      voucherNo: "DON-001",
    });
  });

  it("keeps the donor's name off the public shape and on the office one", () => {
    const admin = toAdminDonation(donationDoc(), "DON-001");

    expect(admin).not.toHaveProperty("transactionId");
    expect(admin).not.toHaveProperty("recordedById");
  });

  it("says that a voucher could not be read, rather than showing a blank reference", () => {
    expect(toAdminDonation(donationDoc(), null).voucherNo).toBeNull();
  });
});

describe("donationsPageOf", () => {
  it("pairs each contribution with the voucher standing beside it", () => {
    const page = donationsPageOf([{ ...donationDoc(), _id: DONATION }], [voucher()]);

    expect(page.state).toBe("ready");
    if (page.state !== "ready") return;
    expect(page.items).toEqual([
      {
        id: DONATION.toHexString(),
        date: "2026-04-12",
        donorName: "Sri Chakma Welfare Board",
        purpose: "Towards the annual cultural meet",
        amountPaise: 50000000,
        acknowledgePublicly: true,
        voucherNo: "DON-001",
      },
    ]);
  });

  it("takes an empty list as nothing recorded, not as a failed read", () => {
    expect(donationsPageOf([], [])).toEqual({ state: "ready", items: [] });
  });

  it("calls the list unreadable when either half of the pair could not be read", () => {
    expect(donationsPageOf(null, [voucher()])).toEqual({ state: "unavailable" });
    expect(donationsPageOf([donationDoc()], null)).toEqual({ state: "unavailable" });
  });

  it("reports a contribution whose ledger line has gone, without inventing a reference", () => {
    const page = donationsPageOf([donationDoc()], []);

    expect(page.state).toBe("ready");
    if (page.state !== "ready") return;
    expect(page.items[0]?.voucherNo).toBeNull();
  });
});

describe("DONATION_VISIBILITY_FILTER", () => {
  it("asks the database for published names only, so a private one never reaches a page", () => {
    expect(DONATION_VISIBILITY_FILTER).toEqual({ acknowledgePublicly: true });
  });
});

describe("saveDonation", () => {
  it("writes the voucher first, then the donation that points at it", async () => {
    const { fake, calls } = stores();

    const written = await saveDonation(input(), TREASURER, fake);

    expect(calls).toEqual(["insertTransaction", "insertDonation"]);
    expect(written).toEqual({
      result: "written",
      donation: expect.objectContaining({ transactionId: VOUCHER, recordedById: TREASURER }),
    });
  });

  it("names the year to open when the branch keeps no accounts for that day", async () => {
    const { fake, calls } = stores({
      insertTransaction: async () => ({
        result: "no_year_for_date",
        date: "2026-04-12",
        fiscalLabel: "2026-27",
      }),
    });

    // The treasurer's next move is to open a year, so the refusal has to carry
    // which one; a bare word would send them to the settings screen guessing.
    await expect(saveDonation(input(), TREASURER, fake)).resolves.toEqual({
      result: "no_year_for_date",
      date: "2026-04-12",
      fiscalLabel: "2026-27",
    });
    expect(calls).toEqual(["insertTransaction"]);
  });

  it("hands back the closed year when the year has been closed", async () => {
    const { fake, calls } = stores({
      insertTransaction: async () => ({ result: "locked", year: A_YEAR }),
    });

    // And the year it names is the voucher's own, not the year of whatever date
    // was typed in — those two can be different, and only one of them is closed.
    await expect(saveDonation(input(), TREASURER, fake)).resolves.toEqual({
      result: "locked",
      year: A_YEAR,
    });
    expect(calls).toEqual(["insertTransaction"]);
  });

  it("takes the voucher back when the donation cannot be kept", async () => {
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fake, calls } = stores({
      insertDonation: async () => {
        throw new Error("the database refused the record");
      },
    });

    expect((await saveDonation(input(), TREASURER, fake)).result).toBe("not_kept");
    expect(calls).toEqual(["insertTransaction", "insertDonation", "deleteTransaction"]);
    // Somebody has to know a pair came apart, or the rollback is a silent hole.
    expect(failure.mock.calls.map(([message]) => message)).toEqual([
      "the donation record failed; taking its ledger line back",
    ]);
    failure.mockRestore();
  });

  it("still says the entry was not kept when the voucher cannot be taken back", async () => {
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fake } = stores({
      insertDonation: async () => {
        throw new Error("the database refused the record");
      },
      deleteTransaction: async () => {
        throw new Error("the database is down");
      },
    });

    await expect(saveDonation(input(), TREASURER, fake)).resolves.toEqual({ result: "not_kept" });
    // The line is left standing in the published accounts, and that is the one
    // outcome an office-bearer has to be told about rather than guessed at.
    expect(failure.mock.calls.map(([message]) => message)).toEqual([
      "the donation record failed; taking its ledger line back",
      "a failed donation left a ledger line that could not be taken back",
    ]);
    failure.mockRestore();
  });
});

describe("editDonation", () => {
  it("changes the voucher it owns and the donation in the same breath", async () => {
    const { fake, calls } = stores({ findDonation: async () => donationDoc() });

    const result = await editDonation(
      DONATION,
      input({ amountPaise: 60000000 }),
      { reason: "The figure was typed one zero short.", byId: TREASURER },
      fake,
    );

    expect(result).toEqual({
      result: "written",
      donation: expect.objectContaining({ amountPaise: 60000000 }),
    });
    expect(calls).toEqual(["findDonation", "replaceTransaction", "replaceDonation"]);
  });

  it("is the only screen that may edit a voucher a donation owns, and says why", async () => {
    const asked: { id: ObjectId; edit: unknown; options: unknown }[] = [];
    const { fake } = stores({
      findDonation: async () => donationDoc(),
      replaceTransaction: async (id, edit, _byId, options) => {
        asked.push({ id, edit, options });
        return { result: "written", transaction: voucher() };
      },
    });

    await editDonation(
      DONATION,
      input(),
      { reason: "The donor's name was spelled wrong.", byId: TREASURER },
      fake,
    );

    expect(asked).toEqual([
      {
        id: VOUCHER,
        edit: { ...donationTransactionInput(input()), reason: "The donor's name was spelled wrong." },
        options: { allowDonationLinked: true },
      },
    ]);
  });

  it("changes neither when the voucher's year is closed", async () => {
    const { fake, calls } = stores({
      findDonation: async () => donationDoc(),
      replaceTransaction: async () => ({ result: "locked", year: A_YEAR }),
    });

    const result = await editDonation(
      DONATION,
      input(),
      { reason: "A figure needed correcting.", byId: TREASURER },
      fake,
    );

    expect(result).toEqual({ result: "locked", year: A_YEAR });
    expect(calls).toEqual(["findDonation", "replaceTransaction"]);
  });

  it("says not_found when there is no such donation", async () => {
    const { fake, calls } = stores();

    expect(
      await editDonation(
        DONATION,
        input(),
        { reason: "A figure needed correcting.", byId: TREASURER },
        fake,
      ),
    ).toEqual({ result: "not_found" });
    expect(calls).toEqual(["findDonation"]);
  });
});

describe("removeDonation", () => {
  it("takes the donation away before the voucher it owned", async () => {
    const { fake, calls } = stores({ findDonation: async () => donationDoc() });

    expect(await removeDonation(DONATION, fake)).toEqual({ result: "written" });
    expect(calls).toEqual(["findDonation", "deleteDonation", "deleteTransaction"]);
  });

  it("leaves the voucher alone when there is no such donation", async () => {
    const { fake, calls } = stores();

    expect(await removeDonation(DONATION, fake)).toEqual({ result: "not_found" });
    expect(calls).toEqual(["findDonation"]);
  });
});

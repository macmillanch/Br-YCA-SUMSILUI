import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  buildTransactionDoc,
  describeChanges,
  guardWriteFor,
  toAdminTransaction,
  transactionDateOutOfYear,
} from "@/lib/finance";
import type { DonationDoc, FinancialYearDoc, TransactionDoc } from "@/lib/types";
import {
  LEDGER_QUERY_SCHEMA,
  SUMMARY_QUERY_SCHEMA,
  TRANSACTION_EDIT_SCHEMA,
  TRANSACTION_SCHEMA,
  type TransactionInput,
} from "@/lib/validation/finance";

const YEAR = {
  _id: new ObjectId(),
  label: "2026-27",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
  openingBalancePaise: 0,
  locked: false,
  createdAt: new Date("2026-04-01T00:00:00Z"),
  updatedAt: new Date("2026-04-01T00:00:00Z"),
};

function voucher(over: Partial<TransactionInput> = {}): TransactionInput {
  return {
    date: "2026-09-24",
    type: "expense",
    category: "event",
    description: "Sound and shelter for the annual meet",
    amountPaise: 1250000,
    voucherNo: "EXP/2026-27/014",
    party: "Laltekmawli contractor",
    projectId: "",
    ...over,
  };
}

/** Every case starts from the same voucher and moves only the fields it names. */
function transactionDoc(over: Partial<TransactionInput> = {}): TransactionDoc {
  return buildTransactionDoc(voucher(over), YEAR._id, null);
}

function donation(over: Partial<DonationDoc> = {}): DonationDoc {
  return {
    _id: new ObjectId(),
    donorName: "A member",
    amountPaise: 500000,
    date: "2026-09-01",
    purpose: "Annual meet",
    acknowledgePublicly: false,
    transactionId: new ObjectId(),
    recordedById: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    ...over,
  };
}

describe("TRANSACTION_SCHEMA", () => {
  it("takes a voucher written the way the book writes it", () => {
    expect(TRANSACTION_SCHEMA.safeParse(voucher()).success).toBe(true);
  });

  it("refuses an amount that is nothing, negative, or finer than a paisa", () => {
    for (const amountPaise of [0, -1250, 12.5, Number.NaN]) {
      expect(
        TRANSACTION_SCHEMA.safeParse(voucher({ amountPaise })).success,
        String(amountPaise),
      ).toBe(false);
    }
  });

  it("refuses a day that does not exist", () => {
    expect(TRANSACTION_SCHEMA.safeParse(voucher({ date: "2026-02-30" })).success).toBe(false);
    expect(TRANSACTION_SCHEMA.safeParse(voucher({ date: "24/09/2026" })).success).toBe(false);
  });

  it("names the field a party or voucher number is missing from", () => {
    const parsed = TRANSACTION_SCHEMA.safeParse(voucher({ party: "", voucherNo: "" }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["party", "voucherNo"]),
      );
    }
  });

  /**
   * `event` is a head money goes out under and `donation` is one it comes in
   * under. Both are real categories, so no list check catches this — only the
   * pair does, and getting it wrong would move money between totals silently.
   */
  it("refuses a head from the wrong side of the ledger", () => {
    const wrongHead = TRANSACTION_SCHEMA.safeParse(
      voucher({ type: "income", category: "event" }),
    );
    expect(wrongHead.success).toBe(false);
    if (!wrongHead.success) {
      expect(wrongHead.error.issues[0]?.message).toMatch(/income/i);
    }
    expect(
      TRANSACTION_SCHEMA.safeParse(voucher({ type: "expense", category: "donation" })).success,
    ).toBe(false);
  });

  it("accepts a voucher belonging to no work and refuses a made-up work id", () => {
    expect(TRANSACTION_SCHEMA.safeParse(voucher({ projectId: "" })).success).toBe(true);
    expect(
      TRANSACTION_SCHEMA.safeParse(voucher({ projectId: "the road repair" })).success,
    ).toBe(false);
  });
});

describe("TRANSACTION_EDIT_SCHEMA", () => {
  it("will not change a figure without a sentence saying why", () => {
    expect(TRANSACTION_EDIT_SCHEMA.safeParse({ ...voucher(), reason: "" }).success).toBe(false);
    expect(TRANSACTION_EDIT_SCHEMA.safeParse({ ...voucher(), reason: "typo" }).success).toBe(false);
  });

  it("accepts the same voucher once the reason is there", () => {
    expect(
      TRANSACTION_EDIT_SCHEMA.safeParse({
        ...voucher(),
        reason: "The contractor's name was spelled wrong.",
      }).success,
    ).toBe(true);
  });
});

/**
 * The year a voucher belongs to is a fact about its date, not a choice, so the
 * builder takes the year from the server-side lookup and the browser's say in
 * the matter is nothing at all.
 */
describe("buildTransactionDoc", () => {
  it("files the voucher under the year it was given", () => {
    const doc = buildTransactionDoc(voucher(), YEAR._id, null);
    expect(doc.yearId).toEqual(YEAR._id);
    expect(doc.date).toBe("2026-09-24");
    expect(doc.amountPaise).toBe(1250000);
    expect(doc.revisions).toEqual([]);
  });

  it("keeps the amount positive, since the direction is a separate field", () => {
    expect(buildTransactionDoc(voucher({ amountPaise: 1250000 }), YEAR._id, null).amountPaise).toBe(
      1250000,
    );
  });

  it("holds no work key at all when the voucher belongs to none", () => {
    const doc = buildTransactionDoc(voucher({ projectId: "" }), YEAR._id, null);
    expect("projectId" in doc).toBe(false);
  });

  it("keeps the work a voucher is charged to when one is named", () => {
    const projectId = new ObjectId();
    const doc = buildTransactionDoc(
      voucher({ projectId: projectId.toHexString() }),
      YEAR._id,
      null,
    );
    expect(doc.projectId).toEqual(projectId);
  });

  it("records who entered it, which is the only way the trail means anything", () => {
    const byId = new ObjectId();
    expect(buildTransactionDoc(voucher(), YEAR._id, byId).entryById).toEqual(byId);
  });
});

describe("transactionDateOutOfYear", () => {
  it("keeps the last day of March inside the year", () => {
    expect(transactionDateOutOfYear("2027-03-31", YEAR)).toBe(false);
  });

  it("puts the first day of April outside it", () => {
    expect(transactionDateOutOfYear("2027-04-01", YEAR)).toBe(true);
  });

  it("keeps 1 April of the year itself inside it", () => {
    expect(transactionDateOutOfYear("2026-04-01", YEAR)).toBe(false);
  });
});

describe("describeChanges", () => {
  it("says nothing when nothing moved", () => {
    expect(describeChanges(transactionDoc(), transactionDoc())).toEqual([]);
  });

  it("reports the corrected amount in rupees, old and new", () => {
    const before = transactionDoc();
    const after = transactionDoc({
      ...voucher({ amountPaise: 1300000 }),
    });
    const changes = describeChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ field: "Amount", from: "₹12,500", to: "₹13,000" });
  });

  it("names a head by what a reader would call it", () => {
    const changes = describeChanges(
      transactionDoc(),
      transactionDoc({ ...voucher({ category: "maintenance" }) }),
    );
    expect(changes[0]).toMatchObject({ field: "Head", from: "Events", to: "Maintenance" });
  });

  it("reports only the fields that actually moved", () => {
    const before = transactionDoc();
    const after = transactionDoc({ ...voucher({ description: "Shelter only" }), voucherNo: "X/1" });
    expect(describeChanges(before, after).map((change) => change.field)).toEqual([
      "Voucher number",
      "Description",
    ]);
  });

  it("says which work the money moved to", () => {
    const before = transactionDoc();
    const workId = new ObjectId();
    const after = transactionDoc({ ...voucher({ projectId: workId.toHexString() }) });
    const changes = describeChanges(before, after);
    expect(changes[0]?.field).toBe("Work");
    expect(changes[0]?.from).toBe("No work");
    expect(changes[0]?.to).toContain(workId.toHexString().slice(0, 6));
  });

  it("names the work by its title when the caller has read one", () => {
    // Half an id belongs in a trail nobody can look up; the branch's own name for
    // the work is what a reader of the trail can check.
    const workId = new ObjectId();
    const after = transactionDoc({ ...voucher({ projectId: workId.toHexString() }) });
    const changes = describeChanges(transactionDoc(), after, new Map([
      [workId.toHexString(), "Solar lighting for the prayer hall"],
    ]));
    expect(changes[0]?.to).toBe("Solar lighting for the prayer hall");
  });

  it("falls back to half an id when the work has since gone", () => {
    const workId = new ObjectId();
    const after = transactionDoc({ ...voucher({ projectId: workId.toHexString() }) });
    const changes = describeChanges(transactionDoc(), after, new Map());
    expect(changes[0]?.to).toContain(workId.toHexString().slice(0, 6));
  });

  /** `updatedAt` and `revisions` move on every edit; saying so would hide the change. */
  it("leaves the bookkeeping out of the trail", () => {
    const before = transactionDoc();
    const after: TransactionDoc = {
      ...before,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-09-30T00:00:00Z"),
      revisions: [{ at: new Date(), byId: null, changes: [], reason: "x" }],
    };
    expect(describeChanges(before, after)).toEqual([]);
  });
});

/**
 * Two rules can apply to one write at once. The lock is the one a treasurer has
 * to be told about first, because reopening a year is somebody else's decision;
 * a donation's voucher is the one they can act on themselves.
 */
describe("guardWriteFor", () => {
  it("lets a voucher through an open year that nothing else claims", () => {
    expect(guardWriteFor({ ...YEAR, locked: false }, null)).toBeNull();
  });

  it("refuses a closed year", () => {
    expect(guardWriteFor({ ...YEAR, locked: true }, null)).toBe("locked");
  });

  it("refuses a voucher a donation owns", () => {
    expect(guardWriteFor({ ...YEAR, locked: false }, donation())).toBe("linked_donation");
  });

  it("names the lock before the donation, because only a super admin can help", () => {
    expect(guardWriteFor({ ...YEAR, locked: true }, donation())).toBe("locked");
  });
});

/**
 * The two ways the ledger is asked for: the whole book, filtered, and one
 * year's totals. A filter that arrived as an empty string means the treasurer
 * chose nothing, and a year named in the wrong shape is a broken link rather
 * than a lookup, so both say so here instead of reaching Mongo.
 */
describe("LEDGER_QUERY_SCHEMA", () => {
  const YEAR_ID = new ObjectId().toHexString();

  it("accepts no filter at all", () => {
    const parsed = LEDGER_QUERY_SCHEMA.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it("accepts the filters the ledger screen offers", () => {
    const parsed = LEDGER_QUERY_SCHEMA.safeParse({
      year: YEAR_ID,
      project: YEAR_ID,
      type: "expense",
      category: "relief",
      q: "Sumsilui",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a year that is not a year the books know", () => {
    const parsed = LEDGER_QUERY_SCHEMA.safeParse({ year: "2026-27" });
    expect(parsed.success).toBe(false);
  });

  it("refuses a search longer than a screen holds", () => {
    expect(LEDGER_QUERY_SCHEMA.safeParse({ q: "a".repeat(101) }).success).toBe(false);
  });
});

describe("SUMMARY_QUERY_SCHEMA", () => {  it("asks for the year a visitor would call this one when no year is given", () => {
    const parsed = SUMMARY_QUERY_SCHEMA.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.year).toBeUndefined();
  });

  it("accepts a fiscal year named the way the accounts are kept", () => {
    expect(SUMMARY_QUERY_SCHEMA.safeParse({ year: "2026-27" }).success).toBe(true);
  });

  it("refuses a year that does not run from 1 April to 31 March", () => {
    const parsed = SUMMARY_QUERY_SCHEMA.safeParse({ year: "2026-12" });
    expect(parsed.success).toBe(false);
  });

  it("refuses a year id, which is what the ledger filter takes", () => {
    expect(SUMMARY_QUERY_SCHEMA.safeParse({ year: new ObjectId().toHexString() }).success).toBe(
      false,
    );
  });
});

/**
 * A voucher as the treasurer's own book shows it — the work it was paid against
 * named, because the screen lists a year's vouchers in date order and a hex
 * string tells nobody anything at a glance.
 */
describe("toAdminTransaction", () => {
  it("names the work a voucher was paid against", () => {
    const workId = new ObjectId();
    const row = toAdminTransaction(
      transactionDoc({ ...voucher({ projectId: workId.toHexString() }) }),
      new Map(),
      new Map([[workId.toHexString(), "Community hall repairs"]]),
    );
    expect(row.projectId).toBe(workId.toHexString());
    expect(row.projectName).toBe("Community hall repairs");
  });

  it("leaves a voucher that belongs to no work saying so", () => {
    const row = toAdminTransaction(transactionDoc(), new Map(), new Map());
    expect(row.projectId).toBeNull();
    expect(row.projectName).toBeNull();
  });

  it("keeps the id when the work has since been removed", () => {
    // A work can be removed while vouchers still stand against it. Blanketing
    // those in as "no work" would silently reclassify money the branch spent.
    const workId = new ObjectId();
    const row = toAdminTransaction(
      transactionDoc({ ...voucher({ projectId: workId.toHexString() }) }),
      new Map(),
      new Map(),
    );
    expect(row.projectId).toBe(workId.toHexString());
    expect(row.projectName).toBeNull();
  });
});

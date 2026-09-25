import { ObjectId, type Filter } from "mongodb";
import type { PublicRead } from "@/lib/content";
import { collection } from "@/lib/db";
import { COLLECTIONS } from "@/lib/index-specs";
import {
  insertTransaction,
  removeTransaction,
  replaceTransaction,
  type DonationLinkedWrite,
  type TransactionInsert,
  type TransactionWrite,
} from "@/lib/finance";
import type { DonationInput } from "@/lib/validation/donations";
import type {
  TransactionEditInput,
  TransactionInput,
} from "@/lib/validation/finance";
import type { DonationDoc } from "@/lib/types";

/**
 * A contribution, and the ledger line it has to leave behind.
 *
 * The two records answer to different screens — the name to the list of thanks on
 * `/donate`, the figure to the published accounts — and §6 will not allow them to
 * drift. So a donation is never saved without its voucher: the voucher is written
 * first, the donation names it, and if the second write fails the first is taken
 * back. Atlas M0 runs without a replica set, so a database transaction cannot
 * span two collections; this is the honest substitute, and the reason the pair is
 * written through one function no caller may split.
 */

/**
 * What a write to a donation answered, `not_kept` being the pair's own failure.
 *
 * A refusal carries the ledger guard's own knowledge with it — which day fell
 * outside every year, which year stands closed. The screen has to name a year
 * for the treasurer to act on, and the only year it may name is the one the
 * guard actually looked at: for a change, that is the year the voucher already
 * belongs to, which need not be the year of the date being typed in.
 */
export type DonationRefusal =
  | Exclude<TransactionWrite, { result: "written" } | { result: "linked_donation" }>
  | { result: "not_kept" };

export type DonationWrite = { result: "written"; donation: DonationDoc } | DonationRefusal;

/** A deletion either took the pair, or says why it did not. Nothing comes back from it. */
export type DonationRemoval = { result: "written" } | DonationRefusal;

/**
 * The two collections, as the seven operations a donation needs. A function that
 * writes across both is only testable if the second half can be made to fail on
 * purpose, so the seam is the writes themselves rather than a mock database.
 */
export type DonationStores = {
  insertTransaction: (input: TransactionInput, byId: ObjectId) => Promise<TransactionInsert>;
  replaceTransaction: (
    id: ObjectId,
    edit: TransactionEditInput,
    byId: ObjectId,
    options: DonationLinkedWrite,
  ) => Promise<TransactionWrite>;
  deleteTransaction: (id: ObjectId) => Promise<unknown>;
  findDonation: (id: ObjectId) => Promise<DonationDoc | null>;
  insertDonation: (doc: DonationDoc) => Promise<unknown>;
  replaceDonation: (doc: DonationDoc) => Promise<boolean>;
  deleteDonation: (id: ObjectId) => Promise<boolean>;
};

/**
 * What the published ledger says a private gift came from. The figure has to
 * stand in the accounts whether or not a name may be shown, and the ledger
 * publishes each entry's party — so the name goes somewhere the donor chose,
 * which is the donation record, and the voucher carries where to ask.
 */
export const UNNAMED_CONTRIBUTION = "Contribution (name with the Treasurer)";

/**
 * The voucher a donation stands for. `party` is the donor when they have agreed
 * to be seen, because that is who the money came from; the purpose is the
 * description, because that is what the figure was for; and no work is named,
 * since a gift is not a work's spending — the figures a work shows come out of
 * expenditure alone.
 */
export function donationTransactionInput(input: DonationInput): TransactionInput {
  return {
    date: input.date,
    type: "income",
    category: "donation",
    description: input.purpose,
    amountPaise: input.amountPaise,
    voucherNo: input.voucherNo,
    party: input.acknowledgePublicly ? input.donorName : UNNAMED_CONTRIBUTION,
    projectId: "",
  };
}

/** The donation, holding the id of the voucher it was written beside. */
export function buildDonationDoc(
  input: DonationInput,
  transactionId: ObjectId,
  recordedById: ObjectId | null,
  now: Date,
  existing?: DonationDoc,
): DonationDoc {
  return {
    _id: existing?._id ?? new ObjectId(),
    donorName: input.donorName,
    amountPaise: input.amountPaise,
    date: input.date,
    purpose: input.purpose,
    acknowledgePublicly: input.acknowledgePublicly,
    transactionId,
    recordedById: existing?.recordedById ?? recordedById,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/**
 * A name, a figure, a day and what it was for — and nothing else. A page that
 * printed the voucher's id, or which office-bearer recorded it, would be
 * publishing details the donor never offered.
 */
export type AcknowledgedDonation = {
  donorName: string;
  amountPaise: number;
  date: string;
  purpose: string;
};

export function toAcknowledgedDonation(doc: DonationDoc): AcknowledgedDonation {
  return {
    donorName: doc.donorName,
    amountPaise: doc.amountPaise,
    date: doc.date,
    purpose: doc.purpose,
  };
}

/**
 * The list the office keeps: everything the public page shows, plus the id a
 * form posts back and the answer about publishing the name. The voucher's own
 * id stays off — a donation screen changes it through this record, never by
 * naming a ledger line.
 */
export type AdminDonation = {
  id: string;
  date: string;
  donorName: string;
  purpose: string;
  amountPaise: number;
  acknowledgePublicly: boolean;
};

export function toAdminDonation(doc: DonationDoc): AdminDonation {
  return {
    id: doc._id.toHexString(),
    date: doc.date,
    donorName: doc.donorName,
    purpose: doc.purpose,
    amountPaise: doc.amountPaise,
    acknowledgePublicly: doc.acknowledgePublicly,
  };
}

/**
 * Asked of the database rather than applied afterwards, so a name nobody agreed
 * to publish never reaches a page's payload at all — the same rule
 * `showContactPublicly` follows in `members.ts`.
 */
export const DONATION_VISIBILITY_FILTER: Filter<DonationDoc> = { acknowledgePublicly: true };

export async function saveDonation(
  input: DonationInput,
  byId: ObjectId,
  stores: DonationStores = ledgerStores,
): Promise<DonationWrite> {
  const added = await stores.insertTransaction(donationTransactionInput(input), byId);
  if (added.result !== "written") return added;

  const transactionId = added.transaction._id;
  const donation = buildDonationDoc(input, transactionId, byId, new Date());
  try {
    await stores.insertDonation(donation);
  } catch (error) {
    console.error("the donation record failed; taking its ledger line back", error);
    try {
      await stores.deleteTransaction(transactionId);
    } catch (undoError) {
      // The one outcome worth shouting about: a voucher the public can read with
      // no donation beside it. It is a real income entry, so leaving it stands is
      // honest — deleting it in silence would not be.
      console.error("a failed donation left a ledger line that could not be taken back", undoError);
    }
    return { result: "not_kept" };
  }
  return { result: "written", donation };
}

/**
 * Changing a contribution changes its voucher, and this is the only caller
 * allowed past the rule that stops the finance screens touching one (§6). The
 * voucher is guarded first — its year may be closed, or the new day may fall
 * outside any year the branch keeps — and the donation follows only once the
 * ledger has accepted the change.
 */
export async function editDonation(
  id: ObjectId,
  input: DonationInput,
  edit: { reason: string; byId: ObjectId },
  stores: DonationStores = ledgerStores,
): Promise<DonationWrite> {
  const existing = await stores.findDonation(id);
  if (!existing) return { result: "not_found" };

  const changed = await stores.replaceTransaction(
    existing.transactionId,
    { ...donationTransactionInput(input), reason: edit.reason },
    edit.byId,
    { allowDonationLinked: true },
  );
  if (changed.result !== "written") {
    // A second donation claiming this voucher is what the unique index exists to
    // prevent, so it cannot happen here. If the data ever says otherwise, neither
    // record moved, which is the same answer as any other refused write.
    return changed.result === "linked_donation" ? { result: "not_kept" } : changed;
  }

  const updated = buildDonationDoc(input, existing.transactionId, edit.byId, new Date(), existing);
  return (await stores.replaceDonation(updated))
    ? { result: "written", donation: updated }
    : { result: "not_kept" };
}

/**
 * Both records go together, the donation first: a voucher whose donation has
 * vanished is a line nobody can account for, while a donation whose voucher is
 * gone would print a figure the published accounts no longer hold.
 */
export async function removeDonation(
  id: ObjectId,
  stores: DonationStores = ledgerStores,
): Promise<DonationRemoval> {
  const existing = await stores.findDonation(id);
  if (!existing) return { result: "not_found" };

  await stores.deleteDonation(id);
  await stores.deleteTransaction(existing.transactionId);
  return { result: "written" };
}

/** Every contribution the office has recorded, the newest first. */
export async function listDonations(): Promise<DonationDoc[]> {
  const donations = await collection<DonationDoc>(COLLECTIONS.donations);
  return donations.find({}).sort({ date: -1 }).limit(500).toArray();
}

/** The public list: only names whose owners agreed to see them here. */
export async function getPublicDonations(
  limit = 24,
): Promise<PublicRead<AcknowledgedDonation>> {
  let items: DonationDoc[];
  try {
    const donations = await collection<DonationDoc>(COLLECTIONS.donations);
    items = await donations
      .find(DONATION_VISIBILITY_FILTER)
      .sort({ date: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error("the acknowledgements could not be read", error);
    return { state: "unavailable" };
  }
  return items.length > 0
    ? { state: "ready", items: items.map(toAcknowledgedDonation) }
    : { state: "empty" };
}

/* ------------------------------------------------------------- the real seam */

async function donationCollection() {
  return collection<DonationDoc>(COLLECTIONS.donations);
}

const ledgerStores: DonationStores = {
  insertTransaction: (input, byId) => insertTransaction(input, byId),
  replaceTransaction: (id, edit, byId, options) => replaceTransaction(id, edit, byId, options),
  // The donation screen owns its voucher, so the guard that keeps the finance
  // screens off one is lifted here and nowhere else.
  deleteTransaction: (id) => removeTransaction(id, { allowDonationLinked: true }),
  findDonation: async (id) => (await donationCollection()).findOne({ _id: id }),
  insertDonation: async (doc) => {
    await (await donationCollection()).insertOne(doc);
  },
  replaceDonation: async (doc) => {
    const result = await (await donationCollection()).replaceOne({ _id: doc._id }, doc, {
      upsert: true,
    });
    return (result.matchedCount ?? 0) > 0 || (result.upsertedCount ?? 0) > 0;
  },
  deleteDonation: async (id) => {
    const { deletedCount } = await (await donationCollection()).deleteOne({ _id: id });
    return (deletedCount ?? 0) > 0;
  },
};

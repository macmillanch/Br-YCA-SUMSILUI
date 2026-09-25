import { ObjectId, type Document } from "mongodb";
import { collection } from "@/lib/db";
import { COLLECTIONS } from "@/lib/index-specs";
import { categoryLabel } from "@/lib/finance-categories";
import { istCalendarDate, longDate } from "@/lib/dates";
import { fiscalYearFromLabel, fiscalYearOf } from "@/lib/fiscal-year";
import { formatPaise } from "@/lib/money";
import type {
  DonationDoc,
  FinancialYearDoc,
  Role,
  TransactionCategory,
  TransactionDoc,
  TransactionRevision,
  TransactionType,
} from "@/lib/types";
import type {
  FinancialYearInput,
  TransactionEditInput,
  TransactionInput,
} from "@/lib/validation/finance";
import { findUserById, userNamesByIds } from "@/lib/users";

/**
 * The branch's books: the years it keeps accounts for, and the vouchers entered
 * against them.
 *
 * Two rules hold this module together. A voucher's year comes from its own date
 * and from nothing else, so a browser cannot file an entry where it likes; and a
 * closed year takes no writes, because the figures the public has already read
 * are the ones the treasurer signed off. Reopening is possible — a wrong figure
 * must be fixable — but only a super-admin may do it, and only after saying why.
 */

/** Keeping the books, and closing a year: the Treasurer's own work. */
export const MANAGE_FINANCE: readonly Role[] = ["treasurer"];

/** Reopening a closed year. Empty means super-admin only, by `canAccess`'s rule. */
export const REOPEN_FINANCIAL_YEAR: readonly Role[] = [];

export type YearWindow = { startDate: string; endDate: string };

export type YearWriteResult = "written" | "duplicate_label" | "overlaps_existing" | "not_found";

export type LockResult = "locked" | "unlocked" | "already_locked" | "already_open" | "not_found";

/** The driver stores an explicit `undefined` as `null`, so absent keys are dropped. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

/**
 * Two years overlap unless one ends before the other begins. The dates are
 * `YYYY-MM-DD`, so comparing them as text is comparing them as days — which is
 * how the rest of this module reads them too.
 */
export function yearsOverlap(a: YearWindow, b: YearWindow): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function yearIsClosed(year: FinancialYearDoc): boolean {
  return year.locked;
}

/**
 * §9 asks a locked year to answer 409 with the date and the name. The date is
 * the day the treasurer saw on their own clock: an instant read back in UTC
 * would report the year closing on the evening before, and a message that gets
 * the day wrong is a message nobody trusts.
 *
 * `lockedByName` is null when the account that closed the year is no longer on
 * the site — a treasurer who has moved on must not turn the message into the
 * word "null" on a screen, and must not be remembered under a name nobody
 * entered either.
 */
export function lockMessage(year: FinancialYearDoc, lockedByName: string | null): string {
  const closedOn = year.lockedAt ? longDate(istCalendarDate(year.lockedAt)) : "a date on record";
  const by = lockedByName ?? "the office-bearer who closed it";
  return `The accounts for ${year.label} were closed on ${closedOn} by ${by}. A closed year is not changed; ask for it to be reopened if a figure is wrong.`;
}

/**
 * The year, from the label alone. A client that sends a `startDate` has it
 * ignored here, because the label is what the treasurer chose and the window is
 * what that label means.
 */
export function buildFinancialYearDoc(
  input: FinancialYearInput,
  existing?: FinancialYearDoc,
): FinancialYearDoc {
  const period = fiscalYearFromLabel(input.label);
  const now = new Date();
  return compact<FinancialYearDoc>({
    _id: existing?._id ?? new ObjectId(),
    label: period.label,
    startDate: period.startDate,
    endDate: period.endDate,
    openingBalancePaise: input.openingBalancePaise,
    locked: existing?.locked ?? false,
    lockedAt: existing?.lockedAt,
    lockedById: existing?.lockedById,
    unlockReason: existing?.unlockReason,
    auditPdfUrl: input.auditPdfUrl === "" ? undefined : input.auditPdfUrl,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/* ------------------------------------------------------------------- years */

async function yearsCollection() {
  return collection<FinancialYearDoc>(COLLECTIONS.financialYears);
}

/** Newest year first, which is the order a reader wants to be offered. */
export async function listFinancialYears(): Promise<FinancialYearDoc[]> {
  const years = await yearsCollection();
  return years.find({}).sort({ startDate: -1 }).limit(60).toArray();
}

export async function getFinancialYear(id: ObjectId): Promise<FinancialYearDoc | null> {
  const years = await yearsCollection();
  return years.findOne({ _id: id });
}

export async function getFinancialYearByLabel(label: string): Promise<FinancialYearDoc | null> {
  const years = await yearsCollection();
  return years.findOne({ label });
}

/**
 * The year a voucher belongs to, found by its date rather than by a year id
 * someone chose. The window is closed at both ends, so 31 March is inside the
 * year it is in and 1 April is not.
 */
export async function financialYearForDate(isoDate: string): Promise<FinancialYearDoc | null> {
  const years = await yearsCollection();
  return years.findOne({ startDate: { $lte: isoDate }, endDate: { $gte: isoDate } });
}

/**
 * Opening a year is refused twice over: against the label the unique index
 * already enforces, and against any window that cuts into a year kept. The
 * second check is the one a hand-typed label can fail, and it is the one that
 * would otherwise let two years claim the same voucher.
 */
export async function openFinancialYear(
  input: FinancialYearInput,
): Promise<{ result: YearWriteResult; year?: FinancialYearDoc; overlappingLabel?: string }> {
  const doc = buildFinancialYearDoc(input);
  const existing = await listFinancialYears();

  const sameLabel = existing.find((year) => year.label === doc.label);
  if (sameLabel) return { result: "duplicate_label", year: sameLabel };

  const overlap = existing.find((year) => yearsOverlap(doc, year));
  if (overlap) return { result: "overlaps_existing", overlappingLabel: overlap.label };

  const years = await yearsCollection();
  try {
    await years.insertOne(doc);
  } catch (error) {
    if (isDuplicateKey(error)) return { result: "duplicate_label" };
    throw error;
  }
  return { result: "written", year: doc };
}

/**
 * The audit report is a detail of the year, not a new year, so it is saved
 * through here rather than by replacing the whole document. An empty address
 * unsets the key: a year with no report attached holds none, rather than an
 * empty string a page would have to second-guess.
 */
export async function setYearAuditReport(
  id: ObjectId,
  auditPdfUrl: string,
): Promise<FinancialYearDoc | null> {
  const years = await yearsCollection();
  const update: Document =
    auditPdfUrl === ""
      ? { $unset: { auditPdfUrl: "" }, $currentDate: { updatedAt: true } }
      : { $set: { auditPdfUrl }, $currentDate: { updatedAt: true } };
  return years.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" });
}

/**
 * Locking and unlocking are the same write in opposite directions, and this is
 * the only place either happens. Who did it is recorded beside the moment, so
 * the 409 the next treasurer sees can name them; reopening clears both and
 * leaves the reason behind, which is the part a reader cannot see for themselves.
 */
export async function setYearLock(
  id: ObjectId,
  locked: boolean,
  byId: ObjectId,
  reason?: string,
): Promise<LockResult> {
  const years = await yearsCollection();
  const year = await years.findOne({ _id: id });
  if (!year) return "not_found";
  if (year.locked === locked) return locked ? "already_locked" : "already_open";

  if (locked) {
    await years.updateOne(
      { _id: id },
      {
        $set: { locked: true, lockedAt: new Date(), lockedById: byId },
        $currentDate: { updatedAt: true },
      },
    );
    return "locked";
  }

  await years.updateOne(
    { _id: id },
    {
      $set: { locked: false, unlockReason: reason ?? "" },
      $unset: { lockedAt: "", lockedById: "" },
      $currentDate: { updatedAt: true },
    },
  );
  return "unlocked";
}

/**
 * §9: a year with vouchers in it is not deleted, it is closed. Removing it would
 * take the entries underneath a published total with it, silently.
 */
export async function removeFinancialYear(
  id: ObjectId,
): Promise<{
  removed: boolean;
  reason: "transactions_exist" | "not_found" | null;
  count: number;
}> {
  const count = await countTransactionsForYear(id);
  if (count > 0) return { removed: false, reason: "transactions_exist", count };

  const years = await yearsCollection();
  const { deletedCount } = await years.deleteOne({ _id: id });
  if ((deletedCount ?? 0) > 0) return { removed: true, reason: null, count };
  return { removed: false, reason: "not_found", count };
}

/* ------------------------------------------------------------------ reads */

export type AdminFinancialYear = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  openingBalancePaise: number;
  locked: boolean;
  /** The day it was closed, as `YYYY-MM-DD`, or null while it is open. */
  lockedOn: string | null;
  unlockReason: string | null;
  auditPdfUrl: string | null;
};

export function toAdminYear(doc: FinancialYearDoc): AdminFinancialYear {
  return {
    id: doc._id.toHexString(),
    label: doc.label,
    startDate: doc.startDate,
    endDate: doc.endDate,
    openingBalancePaise: doc.openingBalancePaise,
    locked: doc.locked,
    lockedOn: doc.lockedAt ? istCalendarDate(doc.lockedAt) : null,
    unlockReason: doc.unlockReason ?? null,
    auditPdfUrl: doc.auditPdfUrl ?? null,
  };
}

/**
 * The name beside a lock. An account that has since been removed is not
 * resurrected under a guess — the message says who closed it when it can, and
 * says nothing more when it cannot.
 */
export async function lockedByNameOf(doc: FinancialYearDoc): Promise<string | null> {
  if (!doc.lockedById) return null;
  const user = await findUserById(doc.lockedById);
  return user?.name ?? null;
}

/**
 * The sentence every route gives back when a year is closed (§9). The name is
 * looked up here rather than passed in, so no handler has to remember that an
 * answer blaming "the office-bearer who closed it" is only acceptable when the
 * account is genuinely gone.
 */
export async function lockedYearMessage(year: FinancialYearDoc): Promise<string> {
  return lockMessage(year, await lockedByNameOf(year));
}

/* ---------------------------------------------------------- transactions */

/** A voucher is looked for by its day, oldest first — the way a cash book reads. */
const LEDGER_LIMIT = 5000;

export type WriteGuard = "locked" | "linked_donation";

/**
 * What a write to the ledger answered, and what it answers with.
 *
 * `no_year_for_date` carries the label the date would fall in, because the
 * treasurer's next move is to open that year and the screen has to name it.
 * `locked` carries the year, so the 409 can say who closed it and when.
 */
export type TransactionWrite =
  | { result: "written"; transaction: TransactionDoc }
  | { result: "no_year_for_date"; date: string; fiscalLabel: string }
  | { result: "locked"; year: FinancialYearDoc }
  | { result: "not_found" }
  | { result: "linked_donation" };

export type TransactionFilter = {
  yearId?: ObjectId | null;
  type?: TransactionType;
  category?: TransactionCategory;
  projectId?: ObjectId | null;
  search?: string;
  limit?: number;
};

/**
 * The two rules that can refuse a write, in the order a treasurer can act on.
 *
 * A closed year is named first: reopening it is somebody else's decision, so the
 * only helpful next step is to ask. A voucher a donation owns is the treasurer's
 * own business — they can go and change it on the donation screen — and saying
 * both at once would bury the one they can use.
 */
export function guardWriteFor(
  year: FinancialYearDoc,
  donationOwner: DonationDoc | null,
): WriteGuard | null {
  if (yearIsClosed(year)) return "locked";
  if (donationOwner) return "linked_donation";
  return null;
}

/**
 * The day a voucher was given, measured against the year it is being kept in.
 * The window is closed at both ends, so 31 March is inside and 1 April is not —
 * which is the boundary §10 names, and the reason a voucher's year is worked out
 * from its date rather than chosen.
 */
export function transactionDateOutOfYear(date: string, year: YearWindow): boolean {
  return date < year.startDate || date > year.endDate;
}

/**
 * The document a voucher becomes. The year it is filed under and who entered it
 * are both handed in by the server: the browser's opinion of either is not used.
 *
 * `entryById` is kept from an existing document on an edit — the trail of who
 * first wrote a line must not quietly become the name of whoever corrected it.
 */
export function buildTransactionDoc(
  input: TransactionInput,
  yearId: ObjectId,
  entryById: ObjectId | null,
  existing?: TransactionDoc,
): TransactionDoc {
  const now = new Date();
  return compact<TransactionDoc>({
    _id: existing?._id ?? new ObjectId(),
    yearId,
    date: input.date,
    type: input.type,
    category: input.category,
    description: input.description,
    amountPaise: input.amountPaise,
    voucherNo: input.voucherNo,
    party: input.party,
    projectId: input.projectId === "" ? undefined : new ObjectId(input.projectId),
    entryById: existing ? existing.entryById : entryById,
    revisions: existing?.revisions ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/**
 * The fields a reader would notice, in the order the book prints them, each with
 * the words a person would use for its value. `createdAt`, `updatedAt` and
 * `revisions` are deliberately absent: they move on every edit, and reporting
 * them would bury the change the treasurer came to make.
 */
const TRAIL_FIELDS: readonly {
  field: string;
  value: (doc: TransactionDoc, titleOfWork?: (id: string) => string) => string;
}[] = [
  { field: "Date", value: (doc) => doc.date },
  { field: "Direction", value: (doc) => (doc.type === "income" ? "Income" : "Expenditure") },
  { field: "Head", value: (doc) => categoryLabel(doc.category) },
  { field: "Voucher number", value: (doc) => doc.voucherNo },
  { field: "Description", value: (doc) => doc.description },
  { field: "Party", value: (doc) => doc.party },
  { field: "Work", value: (doc, titleOfWork) => workLabel(doc, titleOfWork) },
  { field: "Amount", value: (doc) => formatPaise(doc.amountPaise) },
];

/**
 * A work is named by its title when the caller knows one, and by the beginning
 * of its id when it does not. Half an id in an audit trail is honest; a guessed
 * name is not.
 */
function workLabel(doc: TransactionDoc, titleOfWork?: (id: string) => string): string {
  if (!doc.projectId) return "No work";
  const hex = doc.projectId.toHexString();
  return titleOfWork?.(hex) ?? `Work ${hex.slice(0, 6)}`;
}

/**
 * What changed between two versions of the same voucher, as the words a member
 * would read under the line. An empty array means the edit moved nothing, and
 * the caller keeps the trail clean rather than writing a blank entry.
 */
export function describeChanges(
  before: TransactionDoc,
  after: TransactionDoc,
  titleOfWork?: (id: string) => string,
): TransactionRevision["changes"] {
  const changes: TransactionRevision["changes"] = [];
  for (const entry of TRAIL_FIELDS) {
    const from = entry.value(before, titleOfWork);
    const to = entry.value(after, titleOfWork);
    if (from !== to) changes.push({ field: entry.field, from, to });
  }
  return changes;
}

async function transactionsCollection() {
  return collection<TransactionDoc>(COLLECTIONS.transactions);
}

export async function countTransactionsForYear(yearId: ObjectId): Promise<number> {
  const transactions = await transactionsCollection();
  return transactions.countDocuments({ yearId });
}

export async function getTransaction(id: ObjectId): Promise<TransactionDoc | null> {
  const transactions = await transactionsCollection();
  return transactions.findOne({ _id: id });
}

/** Only the characters a `find` needs; a treasurer's search text stays plain text. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listTransactions(filter: TransactionFilter): Promise<TransactionDoc[]> {
  const query: Document = {};
  if (filter.yearId) query.yearId = filter.yearId;
  if (filter.type) query.type = filter.type;
  if (filter.category) query.category = filter.category;
  if (filter.projectId) query.projectId = filter.projectId;

  const search = filter.search?.trim();
  if (search) {
    // Found by number, by party, or by what the money was for — the three ways
    // anybody looks for a voucher a month later.
    query.$or = ["voucherNo", "party", "description"].map((field) => ({
      [field]: { $regex: escapeRegExp(search), $options: "i" },
    }));
  }

  const transactions = await transactionsCollection();
  return transactions
    .find(query)
    .sort({ date: 1, _id: 1 })
    .limit(filter.limit ?? LEDGER_LIMIT)
    .toArray();
}

/**
 * The donation that owns a voucher, if one does. This is the lookup behind the
 * rule that a donation's ledger line is not edited from the finance screens: the
 * acknowledgement list and the accounts are the same entry seen twice, and two
 * forms writing halves of it is how they drift.
 */
export async function donationOwningTransaction(transactionId: ObjectId): Promise<DonationDoc | null> {
  const donations = await collection<DonationDoc>(COLLECTIONS.donations);
  return donations.findOne({ transactionId });
}

export type DonationLinkedWrite = { allowDonationLinked?: boolean };

/**
 * An insert can be refused for two reasons only — no year covers the day, or the
 * year it does cover is closed. Nothing is being replaced, so there is no voucher
 * to fail to find and no donation standing in the way.
 */
export type TransactionInsert = Extract<
  TransactionWrite,
  { result: "written" | "no_year_for_date" | "locked" }
>;

/**
 * Entering a voucher. The year is looked up from the date here and nowhere else,
 * so a request body that names a different year changes nothing about where the
 * entry lands — and a date the branch keeps no accounts for is refused before
 * anything is written.
 */
export async function insertTransaction(
  input: TransactionInput,
  byId: ObjectId,
): Promise<TransactionInsert> {
  const year = await financialYearForDate(input.date);
  if (!year) {
    return {
      result: "no_year_for_date",
      date: input.date,
      fiscalLabel: fiscalYearOf(input.date).label,
    };
  }

  const guard = guardWriteFor(year, null);
  if (guard === "locked") return { result: "locked", year };

  const doc = buildTransactionDoc(input, year._id, byId);
  const transactions = await transactionsCollection();
  await transactions.insertOne(doc);
  return { result: "written", transaction: doc };
}

/**
 * Changing a voucher, and writing the trail that says it was changed.
 *
 * Two years have to be open for this to happen: the one the entry sits in, and
 * the one its date now puts it in. Moving a line out of a closed year would
 * alter figures the public has already read, which is the one thing the lock is
 * for. `allowDonationLinked` is set only by the donation screen, which is the
 * one place a donation's voucher may be edited (§6).
 */
export async function replaceTransaction(
  id: ObjectId,
  input: TransactionEditInput,
  byId: ObjectId,
  options: DonationLinkedWrite = {},
): Promise<TransactionWrite> {
  const transactions = await transactionsCollection();
  const before = await transactions.findOne({ _id: id });
  if (!before) return { result: "not_found" };

  const target = await financialYearForDate(input.date);
  if (!target) {
    return {
      result: "no_year_for_date",
      date: input.date,
      fiscalLabel: fiscalYearOf(input.date).label,
    };
  }

  const leaving = transactionDateOutOfYear(before.date, target)
    ? await getFinancialYear(before.yearId)
    : null;

  // A voucher may not be taken out of a closed year either: the totals the
  // public has read would lose the entry underneath them.
  if (leaving && yearIsClosed(leaving)) return { result: "locked", year: leaving };

  const donation = options.allowDonationLinked ? null : await donationOwningTransaction(id);
  const guard = guardWriteFor(target, donation);
  if (guard === "locked") return { result: "locked", year: target };
  if (guard === "linked_donation") return { result: "linked_donation" };

  const after = buildTransactionDoc(input, target._id, byId, before);
  const changes = describeChanges(before, after);
  if (changes.length === 0) return { result: "written", transaction: before };

  const revision: TransactionRevision = {
    at: new Date(),
    byId,
    changes,
    reason: input.reason,
  };
  const saved = await transactions.findOneAndReplace(
    { _id: id },
    compact<TransactionDoc>({ ...after, revisions: [...before.revisions, revision] }),
    { returnDocument: "after" },
  );
  if (!saved) return { result: "not_found" };
  return { result: "written", transaction: saved };
}

/**
 * Removing a voucher. A closed year keeps its entries whatever the reason; so
 * does a donation, which is deleted through the donation screen instead, where
 * both halves of the record can go together.
 */
export async function removeTransaction(
  id: ObjectId,
  options: DonationLinkedWrite = {},
): Promise<TransactionWrite> {
  const transactions = await transactionsCollection();
  const doc = await transactions.findOne({ _id: id });
  if (!doc) return { result: "not_found" };

  const year = await getFinancialYear(doc.yearId);
  if (year && yearIsClosed(year)) return { result: "locked", year };

  if (!options.allowDonationLinked && (await donationOwningTransaction(id))) {
    return { result: "linked_donation" };
  }

  const { deletedCount } = await transactions.deleteOne({ _id: id });
  if ((deletedCount ?? 0) === 0) return { result: "not_found" };
  return { result: "written", transaction: doc };
}

/* ------------------------------------------------------ reads for the office */

export type AdminTransactionRevision = {
  /** The instant the change was made, as `Date.toISOString()`. */
  at: string;
  byName: string | null;
  changes: TransactionRevision["changes"];
  reason: string;
};

export type AdminTransaction = {
  id: string;
  yearId: string;
  date: string;
  type: TransactionType;
  category: TransactionCategory;
  categoryLabel: string;
  description: string;
  amountPaise: number;
  voucherNo: string;
  party: string;
  projectId: string | null;
  enteredByName: string | null;
  revisions: AdminTransactionRevision[];
};

/**
 * A voucher as the treasurer's screen shows it: the figure still in paise, the
 * head in the words a member would read, and each change with the name of
 * whoever made it. An account that has since left the site gives a `null` the
 * page renders as its own sentence, never the word "null".
 */
export function toAdminTransaction(
  doc: TransactionDoc,
  names: Map<string, string>,
): AdminTransaction {
  return {
    id: doc._id.toHexString(),
    yearId: doc.yearId.toHexString(),
    date: doc.date,
    type: doc.type,
    category: doc.category,
    categoryLabel: categoryLabel(doc.category),
    description: doc.description,
    amountPaise: doc.amountPaise,
    voucherNo: doc.voucherNo,
    party: doc.party,
    projectId: doc.projectId ? doc.projectId.toHexString() : null,
    enteredByName: doc.entryById ? names.get(doc.entryById.toHexString()) ?? null : null,
    revisions: doc.revisions.map((revision) => ({
      at: revision.at.toISOString(),
      byName: revision.byId ? names.get(revision.byId.toHexString()) ?? null : null,
      changes: revision.changes,
      reason: revision.reason,
    })),
  };
}

/** Every account whose name a page's worth of vouchers needs, looked up once. */
export async function namesForTransactions(
  docs: readonly TransactionDoc[],
): Promise<Map<string, string>> {
  const ids = docs.flatMap((doc) => [
    ...(doc.entryById ? [doc.entryById] : []),
    ...doc.revisions.flatMap((revision) => (revision.byId ? [revision.byId] : [])),
  ]);
  return userNamesByIds(ids);
}

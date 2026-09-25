import { ObjectId, type Document } from "mongodb";
import { collection } from "@/lib/db";
import { COLLECTIONS } from "@/lib/index-specs";
import { istCalendarDate, longDate } from "@/lib/dates";
import { fiscalYearFromLabel } from "@/lib/fiscal-year";
import type { FinancialYearDoc, Role, TransactionDoc } from "@/lib/types";
import type { FinancialYearInput } from "@/lib/validation/finance";
import { findUserById } from "@/lib/users";

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

/* ---------------------------------------------------------- transactions */

export async function countTransactionsForYear(yearId: ObjectId): Promise<number> {
  const transactions = await collection<TransactionDoc>(COLLECTIONS.transactions);
  return transactions.countDocuments({ yearId });
}

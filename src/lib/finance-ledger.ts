import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/finance-categories";
import { csvRows } from "@/lib/csv";
import { paiseToRupees } from "@/lib/money";
import type { TransactionCategory, TransactionType } from "@/lib/types";

/**
 * The ledger a member reads, and the ways they narrow it.
 *
 * One year's vouchers arrive oldest-first with the running balance already
 * worked out over the whole of it (see `withRunningBalance`), so filtering here
 * only hides lines — it never re-adds the money. A reader who asks for the
 * grants alone still sees what the branch held on the day each grant came in,
 * which is the number an auditor would find in the cash book.
 */

/** One published line, as the page prints it. */
export type PublicLedgerRow = {
  date: string;
  voucherNo: string;
  description: string;
  party: string;
  type: TransactionType;
  category: TransactionCategory;
  categoryLabel: string;
  amountPaise: number;
};

/** A line with the year's balance beside it, which is how a cash book reads. */
export type PublicLedgerLine = PublicLedgerRow & { runningBalancePaise: number };

/* ------------------------------------------------------------------ filter */

/**
 * Every head the book uses, in the order the two selects print them. A filter
 * for a head is only worth honouring if the head is one a treasurer can enter,
 * so the list is the book's own rather than a copy that could drift from it.
 */
export const LEDGER_HEADS: readonly TransactionCategory[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
];

const DIRECTIONS: readonly TransactionType[] = ["income", "expense"];

export type LedgerFilter = {
  type: TransactionType | null;
  category: TransactionCategory | null;
  search: string;
};

/**
 * Where the filter is read from: a page's `searchParams`, or a download route's
 * own URL. Both are the same three fields, and the page and the file must agree
 * on what they mean or a download would not be the table it came from.
 */
export type LedgerParams =
  | { [key: string]: string | string[] | undefined }
  | URLSearchParams;

/**
 * A URL is a thing a person types, pastes or bookmarks, and a page that answered
 * 400 to `?type=both` would blame them for somebody else's broken link. So an
 * unrecognised value is dropped rather than obeyed or refused, and the ledger
 * prints the year.
 */
function one(params: LedgerParams, key: string): string {
  const raw = params instanceof URLSearchParams ? params.get(key) : params[key];
  const text = Array.isArray(raw) ? raw[0] : raw;
  return text?.trim() ?? "";
}

function direction(value: string): TransactionType | null {
  return DIRECTIONS.find((type) => type === value) ?? null;
}

function head(value: string): TransactionCategory | null {
  return LEDGER_HEADS.find((category) => category === value) ?? null;
}

export function parseLedgerFilter(params: LedgerParams): LedgerFilter {
  return {
    type: direction(one(params, "type")),
    category: head(one(params, "category")),
    search: one(params, "q"),
  };
}

/** Whether the page is showing the whole year or a part of it. */
export function isFiltered(filter: LedgerFilter): boolean {
  return filter.type !== null || filter.category !== null || filter.search !== "";
}

function matches(row: PublicLedgerRow, filter: LedgerFilter): boolean {
  if (filter.type && row.type !== filter.type) return false;
  if (filter.category && row.category !== filter.category) return false;
  if (!filter.search) return true;

  // The three ways anybody looks for a voucher a month later: its number, whose
  // money it was, and what it was spent on.
  const needle = filter.search.toLowerCase();
  return [row.voucherNo, row.party, row.description].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

export function filterLedger<R extends PublicLedgerRow>(
  rows: readonly R[],
  filter: LedgerFilter,
): R[] {
  return rows.filter((row) => matches(row, filter));
}

/* ----------------------------------------------------------------- export */

const LEDGER_CSV_HEADERS = [
  "Date",
  "Voucher no.",
  "Description",
  "Party",
  "Head",
  "Received",
  "Paid out",
  "Running balance",
] as const;

/**
 * The ledger as a spreadsheet, in rupees rather than the paise the books are
 * kept in, because the treasurer's first question about a downloaded year is
 * whether the column adds up — so the money goes out as numbers, unsigned, in
 * the column its own direction belongs to.
 */
export function ledgerCsv(rows: readonly PublicLedgerLine[]): string {
  const lines = rows.map((row) => [
    row.date,
    row.voucherNo,
    row.description,
    row.party,
    row.categoryLabel,
    row.type === "income" ? paiseToRupees(row.amountPaise) : "",
    row.type === "expense" ? paiseToRupees(row.amountPaise) : "",
    paiseToRupees(row.runningBalancePaise),
  ]);

  return csvRows([LEDGER_CSV_HEADERS, ...lines]);
}

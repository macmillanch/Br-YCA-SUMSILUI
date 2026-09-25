import { paiseToRupeesInput, rupeesInputToPaise } from "@/lib/money";
import type { AdminTransaction } from "@/lib/finance";
import type { TransactionCategory, TransactionType } from "@/lib/types";

/**
 * What a voucher form holds, and what it sends, kept apart from the fields that
 * draw them.
 *
 * The division is the rupee box's: a treasurer types rupees and the ledger keeps
 * whole paise, so the one conversion in the screen is the one place a figure can
 * go wrong on its way into the published accounts. Where the figure is decided,
 * it is tested; where it is drawn, it is not.
 */

export type VoucherValues = {
  date: string;
  type: TransactionType;
  category: TransactionCategory | "";
  description: string;
  /** Rupees, as a bank statement writes them; sent as paise. */
  amountRupees: string;
  voucherNo: string;
  party: string;
  /** The work the money was spent against, or "" for none. */
  projectId: string;
};

export const BLANK_VOUCHER: VoucherValues = {
  date: "",
  type: "expense",
  category: "",
  description: "",
  amountRupees: "",
  voucherNo: "",
  party: "",
  projectId: "",
};

/** An existing voucher, back into the shape the form keeps its fields in. */
export function voucherValuesOf(row: AdminTransaction): VoucherValues {
  return {
    date: row.date,
    type: row.type,
    category: row.category,
    description: row.description,
    amountRupees: paiseToRupeesInput(row.amountPaise),
    voucherNo: row.voucherNo,
    party: row.party,
    projectId: row.projectId ?? "",
  };
}

export type WorkOption = { id: string; title: string };

/**
 * The fields as the server wants them, or the complaint about the one box whose
 * value cannot become paise. Everything else is the schema's to refuse; the
 * rupee-to-paise step belongs here, because this is the form that asks for
 * rupees.
 */
export function voucherBodyOf(values: VoucherValues):
  | { ok: true; body: Record<string, string | number> }
  | { ok: false; fieldErrors: Record<string, string> } {
  const amountPaise = rupeesInputToPaise(values.amountRupees);
  if (amountPaise === null) {
    return {
      ok: false,
      fieldErrors: {
        amountPaise: "Write the amount in whole rupees, or with paise as a decimal.",
      },
    };
  }

  return {
    ok: true,
    body: {
      date: values.date,
      type: values.type,
      category: values.category,
      description: values.description,
      amountPaise,
      voucherNo: values.voucherNo,
      party: values.party,
      projectId: values.projectId,
    },
  };
}

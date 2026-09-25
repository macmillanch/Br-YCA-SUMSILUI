import type { AdminDonation } from "@/lib/donations";
import { paiseToRupeesInput, rupeesInputToPaise } from "@/lib/money";

/**
 * What the contribution form holds, and what it sends.
 *
 * A donation form is a voucher form seen from the donor's side, so it carries the
 * same rupee box and the same step down into paise — which is why the step lives
 * here, where it can be tested, rather than inside the fields that draw it.
 *
 * The one field a voucher has no equivalent of is the answer about publishing the
 * name. It is the donor's, not the branch's, so an unchecked box means no: silence
 * is not consent, and a name on the public list is a name somebody agreed to.
 */

export type DonationValues = {
  date: string;
  donorName: string;
  purpose: string;
  /** Rupees, as the receipt writes them; sent as paise. */
  amountRupees: string;
  voucherNo: string;
  acknowledgePublicly: boolean;
};

export const BLANK_DONATION: DonationValues = {
  date: "",
  donorName: "",
  purpose: "",
  amountRupees: "",
  voucherNo: "",
  acknowledgePublicly: false,
};

/**
 * A recorded contribution, back into the shape the form keeps its fields in.
 *
 * `voucherNo` can be null when the ledger line beside the donation cannot be
 * found. It comes back as an empty box rather than an invented number, because
 * the server asks for the reference the paper carries and a figure typed there
 * from memory is a second voucher number, not a correction of the first.
 */
export function donationValuesOf(row: AdminDonation): DonationValues {
  return {
    date: row.date,
    donorName: row.donorName,
    purpose: row.purpose,
    amountRupees: paiseToRupeesInput(row.amountPaise),
    voucherNo: row.voucherNo ?? "",
    acknowledgePublicly: row.acknowledgePublicly,
  };
}

/**
 * The fields as the server wants them, or the complaint about the one box whose
 * value cannot become paise. Everything else is the schema's to refuse.
 */
export function donationBodyOf(values: DonationValues):
  | { ok: true; body: Record<string, string | number | boolean> }
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
      donorName: values.donorName,
      purpose: values.purpose,
      amountPaise,
      voucherNo: values.voucherNo,
      acknowledgePublicly: values.acknowledgePublicly,
    },
  };
}

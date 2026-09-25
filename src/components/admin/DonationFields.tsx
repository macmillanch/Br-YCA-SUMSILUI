"use client";

import type { DonationValues } from "@/lib/donation-form";

/**
 * The six things a contribution says, drawn once for two screens: recording one
 * that has just come in, and correcting one already in the book.
 *
 * There is no field for the amount already published, or for the ledger line. A
 * contribution *is* an income voucher, written beside this record by the same
 * keystroke, so a form that asked for the two separately would be an invitation
 * to make them disagree (§6).
 */

const INPUT =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

export function DonationFields({
  prefix,
  values,
  onChange,
  errors,
}: {
  prefix: string;
  values: DonationValues;
  onChange: (patch: Partial<DonationValues>) => void;
  errors: Record<string, string>;
}) {
  const errorFor = (key: string) =>
    errors[key] ? <span className="mt-1 block text-red-700">{errors[key]}</span> : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm" htmlFor={`${prefix}-date`}>
          <span className="mb-1 block font-medium text-ink">Day it came in</span>
          <input
            id={`${prefix}-date`}
            type="date"
            value={values.date}
            onChange={(event) => onChange({ date: event.target.value })}
            className={INPUT}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            The financial year is worked out from this day, not chosen.
          </span>
          {errorFor("date")}
        </label>

        <label className="block text-sm" htmlFor={`${prefix}-donor`}>
          <span className="mb-1 block font-medium text-ink">Who it came from</span>
          <input
            id={`${prefix}-donor`}
            value={values.donorName}
            onChange={(event) => onChange({ donorName: event.target.value })}
            className={INPUT}
          />
          {errorFor("donorName")}
        </label>

        <label className="block text-sm" htmlFor={`${prefix}-amount`}>
          <span className="mb-1 block font-medium text-ink">Amount in rupees</span>
          <input
            id={`${prefix}-amount`}
            value={values.amountRupees}
            inputMode="decimal"
            onChange={(event) => onChange({ amountRupees: event.target.value })}
            placeholder="5000"
            className={`${INPUT} tabular-nums`}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Whole rupees, or paise as a decimal. A contribution of nothing records nothing.
          </span>
          {errorFor("amountPaise")}
        </label>

        <label className="block text-sm" htmlFor={`${prefix}-voucher`}>
          <span className="mb-1 block font-medium text-ink">Voucher number</span>
          <input
            id={`${prefix}-voucher`}
            value={values.voucherNo}
            onChange={(event) => onChange({ voucherNo: event.target.value })}
            placeholder="REC/2026-27/007"
            className={INPUT}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            The reference on the receipt, so an auditor can match the paper against the book.
          </span>
          {errorFor("voucherNo")}
        </label>
      </div>

      <label className="block text-sm" htmlFor={`${prefix}-purpose`}>
        <span className="mb-1 block font-medium text-ink">What it was given for</span>
        <input
          id={`${prefix}-purpose`}
          value={values.purpose}
          onChange={(event) => onChange({ purpose: event.target.value })}
          className={INPUT}
        />
        {errorFor("purpose")}
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.acknowledgePublicly}
          onChange={(event) => onChange({ acknowledgePublicly: event.target.checked })}
          className="mt-1 h-4 w-4 accent-green-700"
        />
        <span>
          <span className="block font-medium text-ink">Thank this donor in public</span>
          <span className="mt-1 block text-xs text-ink-muted">
            Their name and figure then appear on the public donate page. Left unchecked, the money
            still stands in the accounts and the name stays with the office — a donor who was not
            asked has not agreed.
          </span>
        </span>
      </label>
      {errorFor("acknowledgePublicly")}
    </div>
  );
}

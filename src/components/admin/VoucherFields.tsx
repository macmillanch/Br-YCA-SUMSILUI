"use client";

import { categoriesOf, categoryLabel } from "@/lib/finance-categories";
import type { TransactionCategory, TransactionType } from "@/lib/types";
import type { VoucherValues, WorkOption } from "@/lib/voucher-form";

/**
 * The eight things a voucher says, in the order a paper voucher is filled in.
 *
 * Entered once here because the same eight fields serve two screens: adding a
 * line to the book, and correcting one already in it. Two copies of a form are
 * two chances for one of them to stop asking for something the other still
 * insists on — and the server's schema is the same for both.
 *
 * There is no field for the financial year. The date decides it, and a form that
 * could name a year would be a form that could file an expense among figures the
 * public has already read. What the fields become on the way out is
 * `lib/voucher-form.ts`'s business, where it can be tested.
 */

const INPUT =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

export function VoucherFields({
  prefix,
  values,
  onChange,
  works,
  errors,
  yearWindow,
}: {
  prefix: string;
  values: VoucherValues;
  onChange: (patch: Partial<VoucherValues>) => void;
  works: readonly WorkOption[];
  errors: Record<string, string>;
  yearWindow: { startDate: string; endDate: string };
}) {
  const errorFor = (key: string) =>
    errors[key] ? <span className="mt-1 block text-red-700">{errors[key]}</span> : null;

  // A head can only belong to one direction, so the list a treasurer chooses
  // from follows the direction they picked rather than offering a pair the
  // server would refuse. Switching direction clears a head that no longer fits.
  const heads = categoriesOf(values.type);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm" htmlFor={`${prefix}-date`}>
          <span className="mb-1 block font-medium text-ink">Day the money moved</span>
          <input
            id={`${prefix}-date`}
            type="date"
            value={values.date}
            min={yearWindow.startDate}
            max={yearWindow.endDate}
            onChange={(event) => onChange({ date: event.target.value })}
            className={INPUT}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            The year is worked out from this day, not chosen.
          </span>
          {errorFor("date")}
        </label>

        <label className="block text-sm" htmlFor={`${prefix}-type`}>
          <span className="mb-1 block font-medium text-ink">Direction</span>
          <select
            id={`${prefix}-type`}
            value={values.type}
            onChange={(event) => {
              const type = event.target.value as TransactionType;
              const next = { type } as Partial<VoucherValues>;
              if (values.category && !categoriesOf(type).includes(values.category)) {
                next.category = "";
              }
              onChange(next);
            }}
            className={INPUT}
          >
            <option value="income">Money received</option>
            <option value="expense">Money paid out</option>
          </select>
          {errorFor("type")}
        </label>

        <label className="block text-sm" htmlFor={`${prefix}-category`}>
          <span className="mb-1 block font-medium text-ink">Head</span>
          <select
            id={`${prefix}-category`}
            value={values.category}
            onChange={(event) =>
              onChange({ category: event.target.value as TransactionCategory })
            }
            className={INPUT}
          >
            <option value="">Choose a head</option>
            {heads.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
          {errorFor("category")}
        </label>

        <label className="block text-sm" htmlFor={`${prefix}-amount`}>
          <span className="mb-1 block font-medium text-ink">Amount in rupees</span>
          <input
            id={`${prefix}-amount`}
            value={values.amountRupees}
            inputMode="decimal"
            onChange={(event) => onChange({ amountRupees: event.target.value })}
            placeholder="12500"
            className={`${INPUT} tabular-nums`}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Whole rupees, or paise as a decimal. Always a positive figure — the
            direction is chosen above.
          </span>
          {errorFor("amountPaise")}
        </label>

        <label className="block text-sm" htmlFor={`${prefix}-voucher`}>
          <span className="mb-1 block font-medium text-ink">Voucher number</span>
          <input
            id={`${prefix}-voucher`}
            value={values.voucherNo}
            onChange={(event) => onChange({ voucherNo: event.target.value })}
            placeholder="EXP/2026-27/014"
            className={INPUT}
          />
          {errorFor("voucherNo")}
        </label>

        <label className="block text-sm" htmlFor={`${prefix}-party`}>
          <span className="mb-1 block font-medium text-ink">Received from, or paid to</span>
          <input
            id={`${prefix}-party`}
            value={values.party}
            onChange={(event) => onChange({ party: event.target.value })}
            className={INPUT}
          />
          {errorFor("party")}
        </label>
      </div>

      <label className="block text-sm" htmlFor={`${prefix}-description`}>
        <span className="mb-1 block font-medium text-ink">What it was for</span>
        <input
          id={`${prefix}-description`}
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className={INPUT}
        />
        {errorFor("description")}
      </label>

      <label className="block text-sm" htmlFor={`${prefix}-project`}>
        <span className="mb-1 block font-medium text-ink">Work it belongs to</span>
        <select
          id={`${prefix}-project`}
          value={values.projectId}
          onChange={(event) => onChange({ projectId: event.target.value })}
          className={INPUT}
        >
          <option value="">Not against one particular work</option>
          {works.map((work) => (
            <option key={work.id} value={work.id}>
              {work.title}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-ink-muted">
          What a work has been paid out against is added up from these lines, so a
          figure typed anywhere else would be a second opinion about the same money.
        </span>
        {errorFor("projectId")}
      </label>
    </div>
  );
}

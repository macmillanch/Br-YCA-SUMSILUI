"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { VoucherFields } from "@/components/admin/VoucherFields";
import { Badge } from "@/components/ui/Badge";
import { longDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { AdminTransaction } from "@/lib/finance";
import {
  BLANK_VOUCHER,
  voucherBodyOf,
  voucherValuesOf,
  type VoucherValues,
  type WorkOption,
} from "@/lib/voucher-form";

/**
 * The year's vouchers, with the corrections made to them.
 *
 * A closed year offers no Edit and no Remove. The API would refuse both, and a
 * button that is certain to fail only teaches the person using it to distrust
 * the screens — the lock is explained above the list, where the sentence naming
 * who closed the year already is.
 *
 * An edit asks for a reason in the same breath as it asks for the new figure,
 * because a number a member may already have read cannot change without saying
 * why (§6). The reason is kept beside the old and new values, never instead of
 * them: the trail under a row is what somebody who read the earlier figure has
 * to be able to find a month later.
 */
export function TransactionsTable({
  vouchers,
  locked,
  works,
  yearWindow,
}: {
  vouchers: readonly AdminTransaction[];
  locked: boolean;
  works: readonly WorkOption[];
  yearWindow: { startDate: string; endDate: string };
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Only read while a row is being edited, where `startEdit` has filled it in
  // from that row. It stays blank otherwise.
  const [values, setValues] = useState<VoucherValues>(BLANK_VOUCHER);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const columns = locked ? 7 : 8;

  function startEdit(voucher: AdminTransaction) {
    setEditingId(voucher.id);
    setValues(voucherValuesOf(voucher));
    setReason("");
    setErrors({});
    setRowError(null);
  }

  function cancel() {
    setEditingId(null);
    setErrors({});
  }

  async function save(voucher: AdminTransaction) {
    const prepared = voucherBodyOf(values);
    if (!prepared.ok) {
      setErrors(prepared.fieldErrors);
      return;
    }

    setBusyId(voucher.id);
    setErrors({});
    try {
      const response = await fetch(`/api/finance/transactions/${voucher.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...prepared.body, reason }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setErrors({
          ...body?.error?.fieldErrors,
          form: body?.error?.message ?? "The change could not be saved.",
        });
        return;
      }

      cancel();
      router.refresh();
    } catch {
      setErrors({ form: "Network problem. Nothing changed — please try again." });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(voucher: AdminTransaction) {
    if (
      !window.confirm(
        `Remove ${voucher.voucherNo} from the book? The figures the public reads for the year change with it. A line that was simply wrong is usually corrected rather than removed — a correction keeps the figure somebody has already read.`,
      )
    ) {
      return;
    }

    setBusyId(voucher.id);
    setRowError(null);
    try {
      const response = await fetch(`/api/finance/transactions/${voucher.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setRowError({
          id: voucher.id,
          message: body?.error?.message ?? "That voucher could not be removed.",
        });
        return;
      }
      router.refresh();
    } catch {
      setRowError({
        id: voucher.id,
        message: "Network problem. Nothing was removed — please try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const errorFor = (key: string) =>
    errors[key] ? <span className="mt-1 block text-red-700">{errors[key]}</span> : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <caption className="sr-only">The year&rsquo;s vouchers, with their corrections</caption>
        <thead>
          <tr className="border-b-2 border-green-900 text-left">
            <th scope="col" className="py-2 pr-4 font-semibold">Date</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Voucher</th>
            <th scope="col" className="py-2 pr-4 font-semibold">What it was for</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Head</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Work</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">Amount</th>
            <th scope="col" className="py-2 font-semibold">Entered by</th>
            {locked ? null : <th scope="col" className="py-2 pl-4 font-semibold">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {vouchers.map((voucher) => {
            const editing = editingId === voucher.id;
            return (
              <Fragment key={voucher.id}>
                <tr className="border-b border-line align-top">
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-normal tabular-nums whitespace-nowrap"
                  >
                    {voucher.date}
                  </th>
                  <td className="py-3 pr-4">{voucher.voucherNo}</td>
                  <td className="py-3 pr-4">
                    {voucher.description}
                    <p className="text-xs text-ink-muted">{voucher.party}</p>
                    {voucher.revisions.length > 0 ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-green-700">
                          {voucher.revisions.length === 1
                            ? "1 correction"
                            : `${voucher.revisions.length} corrections`}
                        </summary>
                        <ul className="mt-2 space-y-2 border-l border-line pl-3">
                          {voucher.revisions.map((revision) => (
                            <li key={revision.at} className="text-xs text-ink-muted">
                              <p>
                                {longDate(revision.at.slice(0, 10))} ·{" "}
                                {revision.byName ?? "an account that has since left"}
                                <Badge tone="muted" className="ml-1">
                                  corrected
                                </Badge>
                              </p>
                              <ul>
                                {revision.changes.map((change) => (
                                  <li key={`${revision.at}-${change.field}`}>
                                    {change.field}: {change.from} &rarr; {change.to}
                                  </li>
                                ))}
                              </ul>
                              <p className="italic">{revision.reason}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {rowError?.id === voucher.id ? (
                      <p role="alert" className="mt-2 text-xs text-red-700">
                        {rowError.message}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{voucher.categoryLabel}</td>
                  <td className="py-3 pr-4">
                    {voucher.projectName ?? (voucher.projectId ? "A work no longer listed" : "—")}
                  </td>
                  <td
                    className={`py-3 pr-4 text-right font-medium tabular-nums ${
                      voucher.type === "income" ? "text-green-900" : "text-red-700"
                    }`}
                  >
                    {formatPaise(voucher.amountPaise)}
                  </td>
                  <td className="py-3">{voucher.enteredByName ?? "—"}</td>
                  {locked ? null : (
                    <td className="py-3 pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === voucher.id}
                          onClick={() => (editing ? cancel() : startEdit(voucher))}
                          className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100 disabled:opacity-40"
                        >
                          {editing ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === voucher.id}
                          onClick={() => void remove(voucher)}
                          className="rounded-[4px] border border-line px-2 py-1 text-red-700 hover:bg-red-100 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  )}
                </tr>

                {editing ? (
                  <tr className="border-b border-line">
                    <td colSpan={columns} className="py-3">
                      <div className="space-y-4 rounded-[12px] border border-line bg-paper-alt p-4">
                        <p className="text-sm font-medium text-ink">
                          Correcting {voucher.voucherNo}
                        </p>
                        {errors.form ? (
                          <p
                            role="alert"
                            className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
                          >
                            {errors.form}
                          </p>
                        ) : null}
                        <VoucherFields
                          prefix={voucher.id}
                          values={values}
                          onChange={(patch) =>
                            setValues((current) => ({ ...current, ...patch }))
                          }
                          works={works}
                          errors={errors}
                          yearWindow={yearWindow}
                        />
                        <label className="block text-sm">
                          <span className="mb-1 block font-medium text-ink">
                            Why is this line being changed?
                          </span>
                          <textarea
                            rows={2}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            className="w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700"
                          />
                          <span className="mt-1 block text-xs text-ink-muted">
                            Kept beside the old figure and the new one, and shown to whoever reads
                            the year next.
                          </span>
                          {errorFor("reason")}
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={busyId === voucher.id || reason.trim().length < 10}
                            onClick={() => void save(voucher)}
                            className="rounded-[4px] bg-green-700 px-3 py-1.5 text-xs text-white hover:bg-green-500 disabled:opacity-40"
                          >
                            {busyId === voucher.id ? "Saving" : "Save the change"}
                          </button>
                          <button
                            type="button"
                            onClick={cancel}
                            className="rounded-[4px] border border-line px-3 py-1.5 text-xs text-green-900 hover:bg-green-100"
                          >
                            Leave it as it was
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { DonationFields } from "@/components/admin/DonationFields";
import { Badge } from "@/components/ui/Badge";
import {
  BLANK_DONATION,
  donationBodyOf,
  donationValuesOf,
  type DonationValues,
} from "@/lib/donation-form";
import { formatPaise } from "@/lib/money";
import type { AdminDonation } from "@/lib/donations";

/**
 * The contributions the office holds, with the answer about publishing each name
 * beside it.
 *
 * This is the only screen from which a contribution&rsquo;s ledger line may
 * change. The finance screens are refused it on purpose: a figure edited there
 * and a name edited here would drift apart, and the two are one entry seen from
 * two sides (§6).
 *
 * A row whose voucher cannot be found offers no Edit. Changing a line that is not
 * there would mean typing a new reference from memory, which makes a second
 * voucher rather than correcting the first. Removing it is offered, because
 * removal takes both halves back together and leaves the accounts whole.
 */
export function DonationsTable({ donations }: { donations: readonly AdminDonation[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Only read while a row is being edited, where `startEdit` filled it from that row.
  const [values, setValues] = useState<DonationValues>(BLANK_DONATION);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  function startEdit(donation: AdminDonation) {
    setEditingId(donation.id);
    setValues(donationValuesOf(donation));
    setReason("");
    setErrors({});
    setRowError(null);
  }

  function cancel() {
    setEditingId(null);
    setErrors({});
  }

  async function save(donation: AdminDonation) {
    const prepared = donationBodyOf(values);
    if (!prepared.ok) {
      setErrors(prepared.fieldErrors);
      return;
    }

    setBusyId(donation.id);
    setErrors({});
    try {
      const response = await fetch(`/api/donations/${donation.id}`, {
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

  async function remove(donation: AdminDonation) {
    if (
      !window.confirm(
        `Remove the contribution from ${donation.donorName}? Its ledger line goes with it, so the figures the public reads for the year change too. A name that was simply spelled wrong is usually corrected rather than removed — a correction keeps the figure somebody has already read.`,
      )
    ) {
      return;
    }

    setBusyId(donation.id);
    setRowError(null);
    try {
      const response = await fetch(`/api/donations/${donation.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setRowError({
          id: donation.id,
          message: body?.error?.message ?? "That contribution could not be removed.",
        });
        return;
      }
      router.refresh();
    } catch {
      setRowError({
        id: donation.id,
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
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <caption className="sr-only">The contributions the office holds</caption>
        <thead>
          <tr className="border-b-2 border-green-900 text-left">
            <th scope="col" className="py-2 pr-4 font-semibold">Date</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Who it came from</th>
            <th scope="col" className="py-2 pr-4 font-semibold">What it was given for</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Voucher</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">Amount</th>
            <th scope="col" className="py-2 font-semibold">Name in public</th>
            <th scope="col" className="py-2 pl-4 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {donations.map((donation) => {
            const editing = editingId === donation.id;
            const orphan = donation.voucherNo === null;
            return (
              <Fragment key={donation.id}>
                <tr className="border-b border-line align-top">
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-normal tabular-nums whitespace-nowrap"
                  >
                    {donation.date}
                  </th>
                  <td className="py-3 pr-4">{donation.donorName}</td>
                  <td className="py-3 pr-4">
                    {donation.purpose}
                    {orphan ? (
                      <p className="mt-1 text-xs text-red-700">
                        Its ledger line cannot be found, so this figure may not be in the published
                        accounts. Tell the office; removing the entry takes both halves back.
                      </p>
                    ) : null}
                    {rowError?.id === donation.id ? (
                      <p role="alert" className="mt-2 text-xs text-red-700">
                        {rowError.message}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{donation.voucherNo ?? "—"}</td>
                  <td className="py-3 pr-4 text-right font-medium tabular-nums text-green-900">
                    {formatPaise(donation.amountPaise)}
                  </td>
                  <td className="py-3">
                    <Badge tone={donation.acknowledgePublicly ? "green" : "muted"}>
                      {donation.acknowledgePublicly ? "Published" : "Kept private"}
                    </Badge>
                  </td>
                  <td className="py-3 pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {orphan ? null : (
                        <button
                          type="button"
                          disabled={busyId === donation.id}
                          onClick={() => (editing ? cancel() : startEdit(donation))}
                          className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100 disabled:opacity-40"
                        >
                          {editing ? "Close" : "Edit"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === donation.id}
                        onClick={() => void remove(donation)}
                        className="rounded-[4px] border border-line px-2 py-1 text-red-700 hover:bg-red-100 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>

                {editing ? (
                  <tr className="border-b border-line">
                    <td colSpan={7} className="py-3">
                      <div className="space-y-4 rounded-[12px] border border-line bg-paper-alt p-4">
                        <p className="text-sm font-medium text-ink">
                          Correcting the contribution from {donation.donorName}
                        </p>
                        {errors.form ? (
                          <p
                            role="alert"
                            className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
                          >
                            {errors.form}
                          </p>
                        ) : null}
                        <DonationFields
                          prefix={donation.id}
                          values={values}
                          onChange={(patch) =>
                            setValues((current) => ({ ...current, ...patch }))
                          }
                          errors={errors}
                        />
                        <label className="block text-sm">
                          <span className="mb-1 block font-medium text-ink">
                            Why is this contribution being changed?
                          </span>
                          <textarea
                            rows={2}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            className="w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700"
                          />
                          <span className="mt-1 block text-xs text-ink-muted">
                            Kept on the ledger line beside the old figure and the new one, in the
                            year&rsquo;s book.
                          </span>
                          {errorFor("reason")}
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={busyId === donation.id || reason.trim().length < 10}
                            onClick={() => void save(donation)}
                            className="rounded-[4px] bg-green-700 px-3 py-1.5 text-xs text-white hover:bg-green-500 disabled:opacity-40"
                          >
                            {busyId === donation.id ? "Saving" : "Save the change"}
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

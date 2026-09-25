"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { shortDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { AdminYearRow } from "@/lib/finance";

const FIELD_CLASS =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

/**
 * The years the branch keeps, with each one's own figures beside it.
 *
 * Closing a year is offered to the Treasurer; reopening is not. That is not a
 * shortcut in the interface — the API refuses a treasurer's reopen (§8), and a
 * button that is certain to fail is a button that teaches the person using it
 * that the screens cannot be trusted. So the row says who *can* do it instead.
 */
export function FinancialYearsTable({
  years,
  mayReopen,
}: {
  years: AdminYearRow[];
  mayReopen: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [reopening, setReopening] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function act(id: string, path: string, body?: unknown) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await response.json().catch(() => null)) as {
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setError({
          id,
          message:
            json?.error?.message ??
            Object.values(json?.error?.fieldErrors ?? {})[0] ??
            "That could not be done. Please try again.",
        });
        return;
      }
      setReopening(null);
      setReason("");
      router.refresh();
    } catch {
      setError({ id, message: "Network problem. Nothing changed — please try again." });
    } finally {
      setBusyId(null);
    }
  }

  function close(year: AdminYearRow) {
    if (
      !window.confirm(
        `Close ${year.label}'s accounts? The public reads them as final, and no voucher can be entered or changed afterwards — only a super admin can reopen the year, and they have to say why.`,
      )
    ) {
      return;
    }
    void act(year.id, `/api/finance/years/${year.id}/lock`);
  }

  function reopen(year: AdminYearRow) {
    void act(year.id, `/api/finance/years/${year.id}/unlock`, { reason });
  }

  if (years.length === 0) {
    return (
      <p className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
        No year has been opened yet, so there is nowhere for a voucher to go and the public finance
        page says the accounts have not been published. Opening a year changes both.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Financial years the branch keeps</caption>
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="py-2 pr-4 font-medium">Year</th>
            <th scope="col" className="py-2 pr-4 font-medium">Opening</th>
            <th scope="col" className="py-2 pr-4 font-medium">Income</th>
            <th scope="col" className="py-2 pr-4 font-medium">Expense</th>
            <th scope="col" className="py-2 pr-4 font-medium">Closing</th>
            <th scope="col" className="py-2 pr-4 font-medium">State</th>
            <th scope="col" className="py-2 font-medium">Vouchers</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year.id} className="border-b border-line/60 align-top">
              <td className="py-3 pr-4">
                <Link
                  href={`/admin/finance/${year.label}`}
                  className="font-medium text-green-900 hover:text-green-700"
                >
                  {year.label}
                </Link>
                <p className="text-xs text-ink-muted">
                  {shortDate(year.startDate)} – {shortDate(year.endDate)}
                </p>
                <p className="text-xs text-ink-muted">
                  {year.entryCount === 0
                    ? "Nothing entered yet"
                    : `${year.entryCount} voucher${year.entryCount === 1 ? "" : "s"}`}
                </p>
              </td>
              <td className="py-3 pr-4 tabular-nums">{formatPaise(year.openingBalancePaise)}</td>
              <td className="py-3 pr-4 tabular-nums text-green-900">
                {formatPaise(year.incomePaise)}
              </td>
              <td className="py-3 pr-4 tabular-nums text-red-700">
                {formatPaise(year.expensePaise)}
              </td>
              <td className="py-3 pr-4 font-medium tabular-nums">
                {formatPaise(year.closingPaise)}
              </td>
              <td className="py-3 pr-4">
                <Badge tone={year.locked ? "muted" : "green"}>
                  {year.locked ? "Closed" : "Open"}
                </Badge>
                {year.locked && year.lockedOn ? (
                  <p className="mt-1 text-xs text-ink-muted">Closed {shortDate(year.lockedOn)}</p>
                ) : null}
                {year.unlockReason ? (
                  <p className="mt-1 max-w-[24ch] text-xs text-ink-muted">
                    Reopened: {year.unlockReason}
                  </p>
                ) : null}
                {year.auditPdfUrl ? (
                  <a
                    href={year.auditPdfUrl}
                    className="mt-1 block text-xs text-green-700 underline underline-offset-2"
                  >
                    Audited report
                  </a>
                ) : null}
              </td>
              <td className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/finance/${year.label}`}
                    className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100"
                  >
                    {year.locked ? "Read the book" : "Enter vouchers"}
                  </Link>
                  <Link
                    href={`/finance/${year.label}`}
                    className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100"
                  >
                    Public page
                  </Link>
                  {year.locked ? null : (
                    <button
                      type="button"
                      disabled={busyId === year.id}
                      onClick={() => close(year)}
                      className="rounded-[4px] border border-line px-2 py-1 text-red-700 hover:bg-red-100 disabled:opacity-40"
                    >
                      Close this year
                    </button>
                  )}
                </div>

                {year.locked ? (
                  <div className="mt-2">
                    {mayReopen && reopening !== year.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReopening(year.id);
                          setReason("");
                        }}
                        className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100"
                      >
                        Reopen this year
                      </button>
                    ) : null}
                    {mayReopen && reopening === year.id ? (
                      <div className="mt-1 space-y-2">
                        <label className="block text-xs">
                          <span className="mb-1 block font-medium text-ink">
                            Why is it being reopened?
                          </span>
                          <textarea
                            rows={2}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            className={FIELD_CLASS}
                          />
                          <span className="mt-1 block text-ink-muted">
                            The sentence is kept on the year and shown to whoever reads it next.
                          </span>
                        </label>
                        <button
                          type="button"
                          disabled={busyId === year.id || reason.trim().length < 10}
                          onClick={() => reopen(year)}
                          className="rounded-[4px] bg-green-700 px-3 py-1.5 text-xs text-white hover:bg-green-500 disabled:opacity-40"
                        >
                          Reopen {year.label}
                        </button>
                      </div>
                    ) : null}
                    {mayReopen ? null : (
                      <p className="mt-1 text-xs text-ink-muted">
                        Only a super admin can reopen a closed year, and only with a reason.
                      </p>
                    )}
                  </div>
                ) : null}

                {error?.id === year.id ? (
                  <p role="alert" className="mt-2 text-xs text-red-700">
                    {error.message}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

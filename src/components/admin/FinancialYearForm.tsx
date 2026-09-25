"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { rupeesInputToPaise } from "@/lib/money";

/**
 * Opening a financial year.
 *
 * Only the label is typed, never the dates: 1 April to 31 March follows from it,
 * and a window entered by hand could be made to say anything — including one that
 * overlaps a year whose vouchers the public has already read, which the server
 * refuses and this form shows back.
 *
 * The opening balance is typed in rupees because that is how a bank statement
 * reads, and sent in paise because that is how money is kept here.
 */
export function FinancialYearForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [openingRupees, setOpeningRupees] = useState("");
  const [auditPdfUrl, setAuditPdfUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);

  async function submit() {
    // A blank box is not a filter for nothing — it is the treasurer saying the
    // year began from zero, which the server accepts as 0 and prints as ₹0.
    const openingPaise = openingRupees.trim() === "" ? 0 : rupeesInputToPaise(openingRupees);
    if (openingPaise === null) {
      setErrors({
        openingBalancePaise: "Write the opening balance in whole rupees, or with paise as a decimal.",
      });
      return;
    }

    setBusy(true);
    setErrors({});
    setOpened(null);
    try {
      const response = await fetch("/api/finance/years", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label,
          openingBalancePaise: openingPaise,
          auditPdfUrl: auditPdfUrl.trim(),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { year?: { label?: string } };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setErrors(
          body?.error?.fieldErrors ?? {
            form: body?.error?.message ?? "The year could not be opened.",
          },
        );
        return;
      }

      setLabel("");
      setOpeningRupees("");
      setAuditPdfUrl("");
      setOpened(body?.data?.year?.label ?? label);
      router.refresh();
    } catch {
      setErrors({ form: "Network problem. Nothing was opened — please try again." });
    } finally {
      setBusy(false);
    }
  }

  const errorFor = (key: string) =>
    errors[key] ? <span className="mt-1 block text-red-700">{errors[key]}</span> : null;

  return (
    <form
      className="max-w-2xl space-y-4 rounded-[12px] border border-line bg-paper-alt p-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2 className="text-lg">Open a financial year</h2>
      <p className="text-sm text-ink-muted">
        Opening a year publishes nothing by itself: until vouchers are entered against it, the public
        page shows the year with nothing in it.
      </p>

      {errors.form ? (
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          {errors.form}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Year</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="2026-27"
            className="w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700"
          />
          {errorFor("label")}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Opening balance in rupees</span>
          <input
            value={openingRupees}
            onChange={(event) => setOpeningRupees(event.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink tabular-nums focus:border-green-700"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            What last year closed with, as the audit left it. Leave empty for ₹0.
          </span>
          {errorFor("openingBalancePaise")}
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Audited report, if there is one</span>
        <input
          value={auditPdfUrl}
          onChange={(event) => setAuditPdfUrl(event.target.value)}
          placeholder="https://…"
          className="w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          The address of a report already hosted somewhere. It can also be saved later, after the
          year is closed.
        </span>
        {errorFor("auditPdfUrl")}
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Opening" : "Open the year"}
        </Button>
        {opened ? (
          <span role="status" className="text-sm text-green-700">
            The accounts for {opened} are open.
          </span>
        ) : null}
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VoucherFields } from "@/components/admin/VoucherFields";
import { Button } from "@/components/ui/Button";
import { formatPaise } from "@/lib/money";
import type { AdminTransaction } from "@/lib/finance";
import {
  BLANK_VOUCHER,
  voucherBodyOf,
  type VoucherValues,
  type WorkOption,
} from "@/lib/voucher-form";

/**
 * Entering a voucher into the book.
 *
 * A closed year is not offered an empty form to fill in and be refused by — the
 * screen says whose decision the lock was and when it was taken, which is the
 * sentence the API would otherwise have to repeat after the work was typed.
 *
 * After a line is entered the day and the direction stay: a treasurer booking a
 * single meeting's bills enters several lines the same way, and clearing them
 * each time would mean typing the same facts again — the one thing that produces
 * a voucher filed under the wrong head.
 */
export function TransactionForm({
  works,
  yearWindow,
  lockMessage,
}: {
  works: readonly WorkOption[];
  yearWindow: { startDate: string; endDate: string };
  lockMessage: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<VoucherValues>(BLANK_VOUCHER);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [entered, setEntered] = useState<string | null>(null);

  if (lockMessage) {
    return (
      <p className="rounded-[12px] border border-line bg-paper-alt p-5 text-sm">
        <span className="block font-medium text-ink">This year&rsquo;s accounts are closed</span>
        <span className="mt-1 block text-ink-muted">{lockMessage}</span>
      </p>
    );
  }

  async function submit() {
    const prepared = voucherBodyOf(values);
    if (!prepared.ok) {
      setErrors(prepared.fieldErrors);
      return;
    }

    setBusy(true);
    setErrors({});
    setEntered(null);
    try {
      const response = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prepared.body),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { transaction?: AdminTransaction };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setErrors({
          ...body?.error?.fieldErrors,
          form: body?.error?.message ?? "The voucher could not be entered.",
        });
        return;
      }

      const saved = body?.data?.transaction;
      setEntered(
        saved
          ? `Entered ${formatPaise(saved.amountPaise)} under ${saved.categoryLabel}.`
          : "The voucher is in the book.",
      );
      setValues({
        ...BLANK_VOUCHER,
        date: values.date,
        type: values.type,
        category: values.category,
        projectId: values.projectId,
      });
      router.refresh();
    } catch {
      setErrors({ form: "Network problem. Nothing was entered — please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="max-w-3xl space-y-4 rounded-[12px] border border-line bg-paper-alt p-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2 className="text-lg">Enter a voucher</h2>
      <p className="text-sm text-ink-muted">
        Every figure the public reads is the sum of lines like this one, so a voucher is entered
        once, here, and never typed into a total anywhere else.
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
        prefix="new"
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        works={works}
        errors={errors}
        yearWindow={yearWindow}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Entering" : "Enter this voucher"}
        </Button>
        {entered ? (
          <span role="status" className="text-sm text-green-700">
            {entered}
          </span>
        ) : null}
      </div>
    </form>
  );
}

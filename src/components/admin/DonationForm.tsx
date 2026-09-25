"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DonationFields } from "@/components/admin/DonationFields";
import { Button } from "@/components/ui/Button";
import {
  BLANK_DONATION,
  donationBodyOf,
  type DonationValues,
} from "@/lib/donation-form";
import { formatPaise } from "@/lib/money";
import type { AdminDonation } from "@/lib/donations";

/**
 * Recording a contribution.
 *
 * One entry here writes two records — the income voucher and the donation that
 * names it — because the figure has to be in the published accounts whether or
 * not a name may be printed beside it, and a name has no business appearing
 * where no money was booked (§6).
 *
 * After one is recorded the day, the donor and their answer about publishing the
 * name stay: a collection made at one meeting arrives as several receipts from
 * the same people, and retyping whose consent was given is how a name ends up in
 * public without it.
 *
 * When no year will take an entry the form is not offered at all — the treasurer
 * would have to type a whole receipt before being told there is nowhere to put it.
 */
export function DonationForm({ lockMessage }: { lockMessage: string | null }) {
  const router = useRouter();
  const [values, setValues] = useState<DonationValues>(BLANK_DONATION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [recorded, setRecorded] = useState<string | null>(null);

  if (lockMessage) {
    return (
      <p className="rounded-[12px] border border-line bg-paper-alt p-5 text-sm">
        <span className="block font-medium text-ink">Nothing can be recorded just now</span>
        <span className="mt-1 block text-ink-muted">{lockMessage}</span>
      </p>
    );
  }

  async function submit() {
    const prepared = donationBodyOf(values);
    if (!prepared.ok) {
      setErrors(prepared.fieldErrors);
      return;
    }

    setBusy(true);
    setErrors({});
    setRecorded(null);
    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prepared.body),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { donation?: AdminDonation };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setErrors({
          ...body?.error?.fieldErrors,
          form: body?.error?.message ?? "The contribution could not be recorded.",
        });
        return;
      }

      const saved = body?.data?.donation;
      setRecorded(
        saved
          ? `Recorded ${formatPaise(saved.amountPaise)} from ${saved.donorName}.`
          : "The contribution is in the book.",
      );
      setValues({
        ...BLANK_DONATION,
        date: values.date,
        donorName: values.donorName,
        acknowledgePublicly: values.acknowledgePublicly,
      });
      router.refresh();
    } catch {
      setErrors({ form: "Network problem. Nothing was recorded — please try again." });
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
      <h2 className="text-lg">Record a contribution</h2>
      <p className="text-sm text-ink-muted">
        A contribution is entered once, as money received. The accounts and the thank-you list are
        both made from this entry, so neither is kept up to date anywhere else.
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
        prefix="new"
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        errors={errors}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Recording" : "Record this contribution"}
        </Button>
        {recorded ? (
          <span role="status" className="text-sm text-green-700">
            {recorded}
          </span>
        ) : null}
      </div>
    </form>
  );
}

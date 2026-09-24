"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { STATUS_LABEL } from "@/lib/labels";
import { PAISE_PER_RUPEE } from "@/lib/money";
import type { ProjectStatus } from "@/lib/types";
import type { ProjectInput } from "@/lib/validation/projects";

/**
 * The record of a work. The amount is typed in rupees because that is how a
 * sanction order is written, and handed to the server in paise because that is
 * how money is stored here — one conversion, at the edge, rather than a float
 * that rounds differently in every page that reads it.
 *
 * There is no box for what has been spent. A spend figure can only come from
 * the ledger, and a form that offered to type one would eventually publish a
 * number nobody entered.
 */

const STATUSES: readonly ProjectStatus[] = ["ongoing", "proposed", "completed", "deferred"];

/** Everything the form edits, in the shape a form can hold. */
type FormState = Omit<ProjectInput, "sanctionedAmountPaise" | "beneficiaries"> & {
  sanctionedRupees: string;
  beneficiaries: number;
};

const EMPTY: FormState = {
  title: "",
  slug: "",
  description: "",
  status: "proposed",
  startDate: "",
  targetDate: "",
  completedDate: "",
  sanctionedRupees: "",
  beneficiaries: 0,
  location: "",
  coverImageUrl: "",
  order: 0,
};

function toFormState(values: ProjectInput): FormState {
  return {
    title: values.title,
    slug: values.slug,
    description: values.description,
    status: values.status,
    startDate: values.startDate,
    targetDate: values.targetDate,
    completedDate: values.completedDate,
    sanctionedRupees:
      values.sanctionedAmountPaise === 0 ? "" : String(values.sanctionedAmountPaise / PAISE_PER_RUPEE),
    beneficiaries: values.beneficiaries,
    location: values.location,
    coverImageUrl: values.coverImageUrl,
    order: values.order,
  };
}

/** The screen's rupees become the record's paise, here and nowhere else. */
function toInput(state: FormState, sanctionedAmountPaise: number): ProjectInput {
  return {
    title: state.title,
    slug: state.slug,
    description: state.description,
    status: state.status,
    startDate: state.startDate,
    targetDate: state.targetDate,
    completedDate: state.completedDate,
    sanctionedAmountPaise,
    beneficiaries: state.beneficiaries,
    location: state.location,
    coverImageUrl: state.coverImageUrl,
    order: state.order,
  };
}

/** The keys a plain text input fills in without converting anything. */
type TextKey = Exclude<keyof FormState, "status" | "order" | "beneficiaries">;

const FIELD_CLASS =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

export function ProjectForm({
  projectId,
  initial,
}: {
  projectId?: string;
  initial?: ProjectInput;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(initial ? toFormState(initial) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  /** Rupees on the screen, whole paise on the wire. */
  function amountInPaise(): number | null {
    const typed = values.sanctionedRupees.trim();
    if (typed === "") return 0;
    const rupees = Number(typed);
    if (!Number.isFinite(rupees) || rupees < 0) return null;
    return Math.round(rupees * PAISE_PER_RUPEE);
  }

  async function submit() {
    const sanctionedAmountPaise = amountInPaise();
    if (sanctionedAmountPaise === null) {
      setErrors({
        sanctionedRupees: "Write the sanctioned amount in rupees, like 250000, or leave it empty.",
      });
      return;
    }

    const payload = toInput(values, sanctionedAmountPaise);

    setBusy(true);
    setErrors({});
    setSaved(false);
    try {
      const response = await fetch(projectId ? `/api/projects/${projectId}` : "/api/projects", {
        method: projectId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { project?: { id?: string; slug?: string } };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setErrors(
          body?.error?.fieldErrors ?? {
            form: body?.error?.message ?? "The work could not be saved.",
          },
        );
        return;
      }

      setSaved(true);
      const id = body?.data?.project?.id;
      // A new work has no address of its own until the save lands, and the
      // progress reports hang off that address.
      if (!projectId && id) router.replace(`/admin/works/${id}`);
      router.refresh();
    } catch {
      setErrors({ form: "Network problem. Nothing was saved — please try again." });
    } finally {
      setBusy(false);
    }
  }

  const text = (key: TextKey, label: string, hint?: string) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
        className={FIELD_CLASS}
      />
      {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
      {errors[key] ? <span className="mt-1 block text-red-700">{errors[key]}</span> : null}
    </label>
  );

  const whole = (key: "order" | "beneficiaries", label: string, hint: string) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        value={values[key]}
        onChange={(event) => set(key, Number(event.target.value) || 0)}
        className={FIELD_CLASS}
      />
      <span className="mt-1 block text-xs text-ink-muted">{hint}</span>
      {errors[key] ? <span className="mt-1 block text-red-700">{errors[key]}</span> : null}
    </label>
  );

  const errorList = Object.entries(errors).filter(([key]) => key !== "form");

  return (
    <form className="max-w-2xl space-y-6" noValidate onSubmit={(event) => event.preventDefault()}>
      {errors.form ? (
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          {errors.form}
        </p>
      ) : null}

      {errorList.length > 0 ? (
        <div role="alert" className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm">
          <p className="font-medium text-red-700">Please check these fields:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-700">
            {errorList.map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {text("title", "Name of the work")}
        {text("slug", "Web address", "Leave empty to take it from the name. It cannot be shared twice.")}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">What the work is for</span>
        <textarea
          rows={5}
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
          className={FIELD_CLASS}
        />
        {errors.description ? (
          <span className="mt-1 block text-red-700">{errors.description}</span>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Status</span>
          <select
            value={values.status}
            onChange={(event) => set("status", event.target.value as ProjectStatus)}
            className={FIELD_CLASS}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
          {errors.status ? <span className="mt-1 block text-red-700">{errors.status}</span> : null}
        </label>
        {text("location", "Location")}
        {text("sanctionedRupees", "Sanctioned amount (rupees)", "The amount sanctioned for this work. Whole rupees, or paise as a decimal.")}
        {whole("beneficiaries", "Beneficiaries", "How many people the work is for, as far as the branch knows.")}
        {text("startDate", "Date started", "In the form 2026-09-24, or empty")}
        {text("targetDate", "Target date", "In the form 2026-09-24, or empty")}
        {text("completedDate", "Date completed", "In the form 2026-09-24, or empty")}
        {whole("order", "Order in the list", "A whole number. The works page shows them in this order.")}
      </div>

      {text("coverImageUrl", "Cover photo address", "The upload screen replaces this in a later task.")}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="button" disabled={busy} onClick={submit}>
          {busy ? "Saving" : projectId ? "Save changes" : "Add the work"}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-green-700">
            Saved.
          </span>
        ) : null}
      </div>

      <p className="text-xs text-ink-muted">
        <Link href="/admin/works" className="text-green-700 underline">
          Back to the list
        </Link>
      </p>
    </form>
  );
}

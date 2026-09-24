"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { shortDate } from "@/lib/dates";
import type { AdminProjectUpdate } from "@/lib/projects";

const FIELD_CLASS =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

/**
 * The progress timeline, maintained one dated line at a time.
 *
 * A report is never edited: it is the branch's record of what it saw on a day,
 * and rewriting that record after the fact would leave the site holding a
 * statement nobody made on the date it carries. A wrong line is removed and a
 * new one is added with the date it was actually observed.
 */
export function ProjectUpdates({
  projectId,
  updates,
}: {
  projectId: string;
  updates: AdminProjectUpdate[];
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [percent, setPercent] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function add() {
    // A blank box would reach the server as an empty string, which becomes 0 —
    // and 0% on a public bar is a claim about the work, not an empty field.
    const percentage = Number(percent);
    if (percent.trim() === "" || !Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      setErrors({ percentComplete: "Write the percentage as a whole number from 0 to 100." });
      return;
    }

    setBusy(true);
    setErrors({});
    setSaved(false);
    try {
      const response = await fetch(`/api/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, percentComplete: percentage, text, photos: [] }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setErrors(
          body?.error?.fieldErrors ?? {
            form: body?.error?.message ?? "The report could not be saved.",
          },
        );
        return;
      }

      setDate("");
      setPercent("");
      setText("");
      setSaved(true);
      router.refresh();
    } catch {
      setErrors({ form: "Network problem. Nothing was saved — please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(update: AdminProjectUpdate) {
    if (
      !window.confirm(
        `Remove the report of ${shortDate(update.date)}? The public page loses that line.`,
      )
    ) {
      return;
    }
    setBusyId(update.id);
    try {
      await fetch(`/api/projects/${projectId}/updates/${update.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="max-w-2xl space-y-5" aria-labelledby="progress-reports-heading">
      <h2 id="progress-reports-heading" className="text-xl">
        Progress reports
      </h2>
      <p className="text-sm text-ink-muted">
        One line each time the work is visited, with the percentage as it stood that day. The public
        page shows these newest first, and its bar takes the percentage of the latest one.
      </p>

      {errors.form ? (
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          {errors.form}
        </p>
      ) : null}

      <div className="space-y-4 rounded-[12px] border border-line bg-paper-alt p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Date of the report</span>
            <input
              value={date}
              onChange={(event) => setDate(event.target.value)}
              placeholder="2026-09-24"
              className={FIELD_CLASS}
            />
            {errors.date ? <span className="mt-1 block text-red-700">{errors.date}</span> : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Percentage complete</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              className={FIELD_CLASS}
            />
            {errors.percentComplete ? (
              <span className="mt-1 block text-red-700">{errors.percentComplete}</span>
            ) : null}
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">What has been done</span>
          <textarea
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={FIELD_CLASS}
          />
          {errors.text ? <span className="mt-1 block text-red-700">{errors.text}</span> : null}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={busy} onClick={add}>
            {busy ? "Saving" : "Add to the timeline"}
          </Button>
          {saved ? (
            <span role="status" className="text-sm text-green-700">
              Saved.
            </span>
          ) : null}
        </div>
      </div>

      {updates.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
          Nothing has been reported from the site yet, so the public page says so rather than showing
          an empty bar.
        </p>
      ) : (
        <ul className="space-y-3">
          {updates.map((update) => (
            <li
              key={update.id}
              className="rounded-[12px] border border-line bg-paper p-4 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-medium text-green-900">
                  {shortDate(update.date)} · {update.percentComplete}%
                </p>
                <button
                  type="button"
                  disabled={busyId === update.id}
                  onClick={() => remove(update)}
                  className="rounded-[4px] border border-line px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
              <p className="mt-2 leading-6">{update.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

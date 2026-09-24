"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SettingsValues } from "@/lib/settings";

/**
 * `branchFoundedYear` is the one non-string field, so the text list is typed
 * against the rest. Listing every key would widen the value to
 * `string | number | null` and the inputs would stop type-checking — the kind
 * of thing that gets "fixed" with a cast and then quietly accepts a string year.
 */
type TextKey = Exclude<keyof SettingsValues, "branchFoundedYear">;

type Field = {
  name: TextKey;
  label: string;
  hint?: string;
  multiline?: boolean;
  autoComplete?: string;
};

const GROUPS: { title: string; note?: string; fields: Field[] }[] = [
  {
    title: "Identity",
    fields: [
      { name: "branchName", label: "Branch name" },
      {
        name: "registrationNo",
        label: "Registration number",
        hint: "Societies Registration Act number, if registered",
      },
      { name: "footerNote", label: "Footer note", hint: "One line shown beside the finance link" },
    ],
  },
  {
    title: "Contact",
    note: "Anything left blank is shown on the site as “not published yet”, never guessed.",
    fields: [
      { name: "addressLine", label: "Office address" },
      { name: "district", label: "District" },
      { name: "state", label: "State" },
      { name: "phone", label: "Office phone", autoComplete: "tel" },
      { name: "email", label: "Email", autoComplete: "email" },
      {
        name: "whatsappNumber",
        label: "WhatsApp number",
        hint: "With country code, e.g. 919876543210",
      },
      { name: "facebookUrl", label: "Facebook page", hint: "https://facebook.com/…" },
    ],
  },
  {
    title: "About the branch",
    fields: [
      { name: "aboutText", label: "About", multiline: true },
      { name: "missionText", label: "Mission and objectives", multiline: true },
    ],
  },
  {
    title: "Donations",
    note: "These are printed on the public donate page. Double-check every digit before saving.",
    fields: [
      { name: "bankName", label: "Bank name" },
      { name: "bankBranch", label: "Branch" },
      { name: "accountNumber", label: "Account number" },
      { name: "ifsc", label: "IFSC" },
      { name: "upiId", label: "UPI ID", hint: "name@bank" },
    ],
  },
];

const FIELD_CLASS =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof SettingsValues>(name: K, value: SettingsValues[K]) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setStatus("idle");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setErrors({});
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;
      if (!response.ok) {
        setStatus("idle");
        setErrors(
          body?.error?.fieldErrors ?? { form: body?.error?.message ?? "Could not save." },
        );
        return;
      }
      setStatus("saved");
    } catch {
      setStatus("idle");
      setErrors({ form: "Network problem. Nothing was saved — please try again." });
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-10" noValidate>
      {errors.form ? (
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          {errors.form}
        </p>
      ) : null}

      {GROUPS.map((group) => (
        <fieldset key={group.title} className="space-y-4">
          <legend className="mb-1 font-display text-base text-green-900">{group.title}</legend>
          {group.note ? <p className="text-xs text-ink-muted">{group.note}</p> : null}

          {group.fields.map((field) => (
            <label key={field.name} className="block text-sm">
              <span className="mb-1 block font-medium text-ink">{field.label}</span>
              {field.multiline ? (
                <textarea
                  rows={4}
                  value={values[field.name]}
                  onChange={(event) => set(field.name, event.target.value)}
                  className={FIELD_CLASS}
                />
              ) : (
                <input
                  value={values[field.name]}
                  onChange={(event) => set(field.name, event.target.value)}
                  autoComplete={field.autoComplete}
                  className={FIELD_CLASS}
                />
              )}
              {errors[field.name] ? (
                <span className="mt-1 block text-red-700">{errors[field.name]}</span>
              ) : null}
              {field.hint ? <span className="block text-xs text-ink-muted">{field.hint}</span> : null}
            </label>
          ))}
        </fieldset>
      ))}

      <fieldset className="space-y-1">
        <legend className="mb-1 font-display text-base text-green-900">History</legend>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Branch founded year</span>
          <input
            type="number"
            min={1900}
            max={2100}
            value={values.branchFoundedYear ?? ""}
            onChange={(event) =>
              set(
                "branchFoundedYear",
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
            className="w-32 rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink"
          />
          {errors.branchFoundedYear ? (
            <span className="mt-1 block text-red-700">{errors.branchFoundedYear}</span>
          ) : null}
        </label>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving" : "Save settings"}
        </Button>
        {status === "saved" ? (
          <span role="status" className="text-sm text-green-700">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  );
}

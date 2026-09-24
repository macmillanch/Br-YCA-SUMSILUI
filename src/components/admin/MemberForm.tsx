"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { MEMBER_TYPE_LABEL } from "@/lib/labels";
import type { MemberType } from "@/lib/types";
import type { MemberInput } from "@/lib/validation/members";

const TYPES: readonly MemberType[] = [
  "office_bearer",
  "executive_member",
  "advisory_board",
  "community_member",
];

/** The keys a plain text input can fill in without converting anything. */
type TextKey = Exclude<keyof MemberInput, "order" | "current" | "showContactPublicly" | "memberType">;

const FIELD_CLASS =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

const EMPTY: MemberInput = {
  name: "",
  memberType: "office_bearer",
  position: "",
  fatherName: "",
  term: "",
  order: 0,
  current: true,
  showContactPublicly: false,
  phone: "",
  email: "",
  address: "",
  ward: "",
  photoUrl: "",
};

/**
 * The record the branch keeps, not the record the site publishes. Phone, email
 * and address sit here because the office needs them to hand; a public card
 * only ever receives them when `Show contact publicly` is on for that person.
 */
export function MemberForm({
  memberId,
  initial = EMPTY,
}: {
  memberId?: string;
  initial?: MemberInput;
}) {
  const router = useRouter();
  const [values, setValues] = useState<MemberInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof MemberInput>(key: K, value: MemberInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function submit() {
    setBusy(true);
    setErrors({});
    setSaved(false);
    try {
      const response = await fetch(memberId ? `/api/members/${memberId}` : "/api/members", {
        method: memberId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { member?: { id?: string } };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setErrors(
          body?.error?.fieldErrors ?? {
            form: body?.error?.message ?? "The record could not be saved.",
          },
        );
        return;
      }

      setSaved(true);
      const id = body?.data?.member?.id;
      // A new entry has no address of its own until the save lands, and the
      // editor then needs that address to change it again later.
      if (!memberId && id) router.replace(`/admin/members/${id}`);
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

  const tick = (key: "current" | "showContactPublicly", label: string, help: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={values[key]}
        onChange={(event) => set(key, event.target.checked)}
        className="mt-1 h-4 w-4 accent-green-700"
      />
      <span>
        <span className="block font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{help}</span>
      </span>
    </label>
  );

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

      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", "Full name")}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Listed in</span>
          <select
            value={values.memberType}
            onChange={(event) => set("memberType", event.target.value as MemberType)}
            className={FIELD_CLASS}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {MEMBER_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
          {errors.memberType ? (
            <span className="mt-1 block text-red-700">{errors.memberType}</span>
          ) : null}
        </label>
        {text("position", "Position held", "President, General Secretary… empty for none")}
        {text(
          "fatherName",
          "Father's name",
          "The order's F./NAMES column. Held in the branch record; never shown on the public page.",
        )}
        {text("term", "Term of office", "Two years, like 2026-2028")}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Order in the list</span>
          <input
            type="number"
            min={0}
            step={1}
            value={values.order}
            onChange={(event) => set("order", Number(event.target.value) || 0)}
            className={FIELD_CLASS}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            A whole number. The public page shows people in this order.
          </span>
          {errors.order ? <span className="mt-1 block text-red-700">{errors.order}</span> : null}
        </label>
        {text("ward", "Ward or locality")}
      </div>

      <div className="space-y-4 rounded-[12px] border border-line bg-paper-alt p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Contact — kept for the office
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("phone", "Phone")}
          {text("email", "Email")}
        </div>
        {text("address", "Address")}
        {tick(
          "showContactPublicly",
          "Show contact publicly",
          "Off means the phone and email never reach the public page. Turn it on only with that person's agreement.",
        )}
      </div>

      {text("photoUrl", "Photo web address", "The upload screen replaces this in a later task.")}

      {values.memberType === "community_member" ? null : (
        <div className="rounded-[12px] border border-line bg-paper-alt p-5">
          {tick(
            "current",
            "Holds this office now",
            "Turn off for an office-bearer of an earlier term. They move under Past office-bearers.",
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="button" disabled={busy} onClick={submit}>
          {busy ? "Saving" : memberId ? "Save changes" : "Add to the list"}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-green-700">
            Saved.
          </span>
        ) : null}
      </div>

      <p className="text-xs text-ink-muted">
        <Link href="/admin/members" className="text-green-700 underline">
          Back to the list
        </Link>
      </p>
    </form>
  );
}

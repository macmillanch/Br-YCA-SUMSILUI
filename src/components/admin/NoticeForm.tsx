"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { KIND_LABEL } from "@/lib/labels";
import { slugFromTitle } from "@/lib/slug";
import type { NoticeKind } from "@/lib/types";
import type { NoticeInput } from "@/lib/validation/notices";

type Values = Omit<NoticeInput, "status">;
type Key = keyof Values;

const KINDS: readonly NoticeKind[] = ["notice", "announcement", "press_release"];

const TABS = [
  { id: "en", label: "English" },
  { id: "bn", label: "Bangla" },
  { id: "cdp", label: "Chakma" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** So a mistake in a panel that is hidden still shows up on its tab. */
const TAB_FIELDS: Record<TabId, Key[]> = {
  en: ["titleEn", "bodyEn"],
  bn: ["titleBn", "bodyBn"],
  cdp: ["titleCdp", "bodyCdp"],
};

const FIELD_CLASS =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

const EMPTY: Values = {
  kind: "notice",
  titleEn: "",
  bodyEn: "",
  slug: "",
  eventDate: "",
  venue: "",
  titleBn: "",
  bodyBn: "",
  titleCdp: "",
  bodyCdp: "",
};

/**
 * English is the language the record is kept in; the other two panels exist
 * because a notice that only one section of the community can read has not been
 * read by everyone. A panel left empty offers nothing to the reader, and a half
 * filled one is refused by the server with the reason shown here.
 */
export function NoticeForm({
  noticeId,
  initial = EMPTY,
  publishedOn,
}: {
  noticeId?: string;
  initial?: Values;
  publishedOn?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [slugOwned, setSlugOwned] = useState(initial.slug !== "" && initial.slug !== slugFromTitle(initial.titleEn));
  const [tab, setTab] = useState<TabId>("en");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function set<K extends Key>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  function titleChange(next: string) {
    setValues((prev) => ({
      ...prev,
      titleEn: next,
      slug: slugOwned ? prev.slug : slugFromTitle(next),
    }));
    setSavedAt(null);
  }

  const errorList = Object.entries(errors).filter(([key]) => key !== "form");

  async function submit(status: NoticeInput["status"]) {
    setBusy(true);
    setErrors({});
    setSavedAt(null);
    try {
      const response = await fetch(noticeId ? `/api/notices/${noticeId}` : "/api/notices", {
        method: noticeId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, status }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { notice?: { id?: string; updatedOn?: string } };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setErrors(body?.error?.fieldErrors ?? {
          form: body?.error?.message ?? "The notice could not be saved.",
        });
        return;
      }

      setSavedAt(body?.data?.notice?.updatedOn ?? "just now");
      // A new notice has no address of its own yet; land the editor on its edit
      // screen so publishing or further languages are one click away.
      const id = body?.data?.notice?.id;
      if (!noticeId && id) router.replace(`/admin/notices/${id}`);
      router.refresh();
    } catch {
      setErrors({ form: "Network problem. Nothing was saved — please try again." });
    } finally {
      setBusy(false);
    }
  }

  const errorFor = (key: Key) =>
    errors[key] ? <span className="mt-1 block text-red-700">{errors[key]}</span> : null;

  const text = (key: Key, label: string, hint?: string) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        value={values[key]}
        onChange={(event) => (key === "titleEn" ? titleChange(event.target.value) : set(key, event.target.value))}
        className={FIELD_CLASS}
      />
      {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
      {errorFor(key)}
    </label>
  );

  const paragraph = (key: Key, label: string, rows = 12) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <textarea
        rows={rows}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
        className={`${FIELD_CLASS} leading-6`}
      />
      {errorFor(key)}
    </label>
  );

  return (
    <form className="max-w-3xl space-y-6" noValidate onSubmit={(event) => event.preventDefault()}>
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
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Type of notice</span>
          <select
            value={values.kind}
            onChange={(event) => set("kind", event.target.value as NoticeKind)}
            className={FIELD_CLASS}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
          {errorFor("kind")}
        </label>
        {text("slug", "Web address", "/notices/… — letters, numbers and hyphens")}
        {text("eventDate", "Date of the event", "Leave empty if there is none, e.g. 2026-10-02")}
        {text("venue", "Venue")}
      </div>

      <div>
        <div className="flex gap-1 border-b border-line" role="tablist" aria-label="Languages">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={`rounded-t-[4px] px-3 py-2 text-sm ${
                tab === entry.id
                  ? "border border-line border-b-paper bg-paper font-medium text-green-900"
                  : "text-ink-muted hover:bg-green-100"
              }`}
            >
              {entry.label}
              {TAB_FIELDS[entry.id].some((key) => errors[key]) ? (
                <span className="ml-1 text-red-700">•</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="space-y-4 pt-5">
          {tab === "en" ? (
            <>
              {text("titleEn", "Title in English")}
              {paragraph("bodyEn", "Text of the notice in English")}
              <p className="text-xs text-ink-muted">
                Blank lines start a new paragraph. Nothing typed here is ever read as HTML.
              </p>
            </>
          ) : null}

          {tab === "bn" ? (
            <>
              {text("titleBn", "Title in Bangla")}
              {paragraph("bodyBn", "Text in Bangla")}
            </>
          ) : null}

          {tab === "cdp" ? (
            <>
              {text("titleCdp", "Title in Chakma")}
              {paragraph("bodyCdp", "Text in Chakma")}
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="button" variant="ghost" disabled={busy} onClick={() => submit("draft")}>
          {busy ? "Saving" : "Save as draft"}
        </Button>
        <Button type="button" disabled={busy} onClick={() => submit("published")}>
          {busy ? "Saving" : "Save and publish"}
        </Button>
        {savedAt ? (
          <span role="status" className="text-sm text-green-700">
            Saved {savedAt}.
          </span>
        ) : null}
      </div>

      <p className="text-xs text-ink-muted">
        {noticeId ? (
          publishedOn ? (
            <>Published {publishedOn}. Saving changes what a reader sees at once.</>
          ) : (
            <>This notice is a draft. Only people with the admin address can see it.</>
          )
        ) : (
          <>A notice saved as a draft stays out of the public list until it is published.</>
        )}
        {" "}
        <Link href="/admin/notices" className="text-green-700 underline">
          Back to the list
        </Link>
      </p>
    </form>
  );
}

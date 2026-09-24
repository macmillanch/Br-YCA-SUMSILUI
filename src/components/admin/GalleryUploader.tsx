"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { GalleryItemInput } from "@/lib/validation/gallery";

/**
 * Adding one picture and the words that go with it.
 *
 * A file and an address are two ways of arriving at the same record: the file
 * travels to the branch's image store and comes back as an address, and an
 * address can be typed when the store is not connected yet. The words are
 * required either way, because a photograph on a public page without a
 * description is a photograph nobody can read.
 */

const FIELD_CLASS =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

type Values = Omit<GalleryItemInput, "order"> & { order: number };

const EMPTY: Values = {
  album: "",
  caption: "",
  alt: "",
  imageUrl: "",
  takenAt: "",
  order: 0,
};

type ApiBody = {
  data?: { url?: string; thumbUrl?: string };
  error?: { message?: string; fieldErrors?: Record<string, string> };
};

export function GalleryUploader({ albumNames }: { albumNames: readonly string[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function submit() {
    setBusy(true);
    setErrors({});
    setSaved(false);
    try {
      let imageUrl = values.imageUrl.trim();

      if (file) {
        const form = new FormData();
        form.set("file", file);
        const upload = await fetch("/api/upload", { method: "POST", body: form });
        const uploadBody = (await upload.json().catch(() => null)) as ApiBody | null;
        if (!upload.ok) {
          // The words typed for this picture stay on the screen: a store that is
          // not configured is no reason to lose what the office-bearer wrote.
          setErrors({ file: uploadBody?.error?.message ?? "The picture could not be uploaded." });
          return;
        }
        imageUrl = uploadBody?.data?.url ?? "";
      }

      const response = await fetch("/api/gallery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, imageUrl }),
      });
      const body = (await response.json().catch(() => null)) as ApiBody | null;
      if (!response.ok) {
        setErrors(
          body?.error?.fieldErrors ?? { form: body?.error?.message ?? "The picture could not be saved." },
        );
        return;
      }

      setSaved(true);
      setFile(null);
      setValues((prev) => ({ ...prev, caption: "", alt: "", imageUrl: "", takenAt: "", order: 0 }));
      router.refresh();
    } catch {
      setErrors({ form: "Network problem. Nothing was saved — please try again." });
    } finally {
      setBusy(false);
    }
  }

  const errorList = Object.entries(errors).filter(([key]) => key !== "form");

  return (
    <form
      className="max-w-2xl space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {errors.form ? (
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          {errors.form}
        </p>
      ) : null}

      {errorList.length > 0 ? (
        <div
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm"
        >
          <p className="font-medium text-red-700">This picture could not be added:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-700">
            {errorList.map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Album</span>
        <input
          value={values.album}
          onChange={(event) => set("album", event.target.value)}
          list="known-albums"
          className={FIELD_CLASS}
          placeholder="Annual general meeting 2026"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Pictures sharing a name appear together on the gallery page. Writing the name out again
          starts a new album.
        </span>
        {errors.album ? <span className="mt-1 block text-red-700">{errors.album}</span> : null}
      </label>

      <datalist id="known-albums">
        {albumNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Caption</span>
          <input
            value={values.caption}
            onChange={(event) => set("caption", event.target.value)}
            className={FIELD_CLASS}
            placeholder="The office-bearers elected for the term"
          />
          {errors.caption ? <span className="mt-1 block text-red-700">{errors.caption}</span> : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Day it was taken</span>
          <input
            value={values.takenAt}
            onChange={(event) => set("takenAt", event.target.value)}
            className={FIELD_CLASS}
            placeholder="2026-04-18, or empty"
          />
          {errors.takenAt ? <span className="mt-1 block text-red-700">{errors.takenAt}</span> : null}
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Description for a screen reader</span>
        <textarea
          rows={2}
          value={values.alt}
          onChange={(event) => set("alt", event.target.value)}
          className={FIELD_CLASS}
          placeholder="Nine people seated at a long table under a banner"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          What someone who cannot see the picture would need to hear: who is there, and what is
          happening.
        </span>
        {errors.alt ? <span className="mt-1 block text-red-700">{errors.alt}</span> : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Picture file</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setSaved(false);
            }}
            className="w-full text-sm"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            JPEG, PNG or WebP, up to 8 MB. The file is checked before it leaves the server.
          </span>
          {errors.file ? <span className="mt-1 block text-red-700">{errors.file}</span> : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Picture web address</span>
          <input
            value={values.imageUrl}
            onChange={(event) => set("imageUrl", event.target.value)}
            className={FIELD_CLASS}
            placeholder="https://…"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            An upload fills this in by itself. Type an address only while the branch&rsquo;s photo
            store is not connected.
          </span>
          {errors.imageUrl ? (
            <span className="mt-1 block text-red-700">{errors.imageUrl}</span>
          ) : null}
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Order in the album</span>
        <input
          type="number"
          min={0}
          step={1}
          value={values.order}
          onChange={(event) => set("order", Number(event.target.value) || 0)}
          className={FIELD_CLASS}
        />
        {errors.order ? <span className="mt-1 block text-red-700">{errors.order}</span> : null}
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" disabled={busy}>
          {busy ? "Adding" : "Add the picture"}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-green-700">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  );
}

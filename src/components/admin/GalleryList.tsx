"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminGalleryItem } from "@/lib/gallery";

/**
 * What has been published, album by album, with the way to take a wrong picture
 * back down. Removing a row here does not delete the photograph from the store —
 * it only stops the public page showing it, which is the reversible half of the
 * decision.
 */
export function GalleryList({ items }: { items: AdminGalleryItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removedCaption, setRemovedCaption] = useState<string | null>(null);

  async function remove(item: AdminGalleryItem) {
    if (!window.confirm(`Take "${item.caption}" off the gallery page?`)) return;
    setBusyId(item.id);
    setError(null);
    setRemovedCaption(null);
    try {
      const response = await fetch(`/api/gallery/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("That picture could not be removed. Please try again.");
        return;
      }
      setRemovedCaption(item.caption);
      router.refresh();
    } catch {
      setError("Network problem. Nothing was removed — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {/* Above the empty state, not inside the list: the last picture removed is
          the removal that most needs saying, and a page that only says "nothing
          here" leaves the office-bearer wondering whether their click did anything. */}
      {removedCaption ? (
        <p role="status" className="text-sm text-green-700">
          Removed. &ldquo;{removedCaption}&rdquo; is no longer on the gallery page.
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
          No picture is on the gallery page. The first one added appears there at once.
        </p>
      ) : (
        <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start gap-4 rounded-[12px] border border-line p-3"
          >
            <img
              src={item.thumbUrl}
              alt=""
              width={160}
              height={120}
              loading="lazy"
              className="h-[90px] w-[120px] rounded-[8px] border border-line object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-green-900">{item.caption}</p>
              <p className="text-xs text-ink-muted">
                {item.album}
                {item.takenAt ? ` · ${item.takenAt}` : ""} · order {item.order}
              </p>
              <p className="mt-1 break-all text-xs text-ink-muted">{item.imageUrl}</p>
              <p className="mt-1 text-xs text-ink-muted">{item.alt}</p>
            </div>
            <button
              type="button"
              disabled={busyId === item.id}
              aria-label={`Remove ${item.caption} from the gallery`}
              onClick={() => remove(item)}
              className="rounded-[4px] border border-line px-2 py-1 text-sm text-red-700 hover:bg-red-100 disabled:opacity-40"
            >
              Remove
            </button>
          </li>
          ))}
        </ul>
      )}
    </div>
  );
}

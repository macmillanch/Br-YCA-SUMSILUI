"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { KIND_LABEL } from "@/lib/labels";
import { shortDate } from "@/lib/dates";
import type { AdminNotice } from "@/lib/notices";

/**
 * The list an editor works from. Publishing and withdrawing are here because
 * they are one-click actions on a notice that is already written; the writing
 * itself is on the edit screen.
 */
export function NoticesTable({ notices }: { notices: AdminNotice[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The notice as its own write came back, against the row it was answered to.
  const [applied, setApplied] = useState<{
    id: string;
    notice: AdminNotice;
    on: AdminNotice;
  } | null>(null);

  const rows = useMemo(() => {
    if (!applied) return notices;
    const current = notices.find((notice) => notice.id === applied.id);
    // Once the server has sent this row again, what it says is newer than the
    // click was, and the patch has nothing left to cover.
    if (!current || current !== applied.on) return notices;
    return notices.map((notice) =>
      notice.id === applied.id ? { ...notice, ...applied.notice } : notice,
    );
  }, [notices, applied]);

  async function send(notice: AdminNotice, body: unknown, failure: string) {
    setBusyId(notice.id);
    setError(null);
    try {
      const response = await fetch(`/api/notices/${notice.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const parsed = (await response.json().catch(() => null)) as {
        data?: { notice?: AdminNotice };
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(parsed?.error?.message ?? failure);
        return;
      }
      // The answer names the notice it changed, so its row can say what it is now
      // rather than wait for the next render of the screen to get around to it.
      const changed = parsed?.data?.notice;
      const row = notices.find((each) => each.id === notice.id) ?? notice;
      setApplied(changed && changed.id === notice.id ? { id: notice.id, notice: changed, on: row } : null);
      router.refresh();
    } catch {
      setError("Network problem. Nothing was changed — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(notice: AdminNotice) {
    // A notice that has been shared on WhatsApp cannot be un-shared, so the
    // branch is asked to be sure before the record goes.
    if (!window.confirm(`Delete “${notice.titleEn}”? This cannot be undone.`)) return;
    setBusyId(notice.id);
    setError(null);
    try {
      const response = await fetch(`/api/notices/${notice.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("That notice could not be deleted. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network problem. Nothing was deleted — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (notices.length === 0) {
    return (
      <p className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
        No notices yet. Write the first one and it will appear here.
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Notices and press releases</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-2 pr-4 font-medium">Title</th>
              <th scope="col" className="py-2 pr-4 font-medium">Type</th>
              <th scope="col" className="py-2 pr-4 font-medium">Status</th>
              <th scope="col" className="py-2 pr-4 font-medium">Published</th>
              <th scope="col" className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((notice) => {
              const busy = busyId === notice.id;
              return (
                <tr key={notice.id} className="border-b border-line/60 align-middle">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/notices/${notice.id}`}
                      className="font-medium text-green-900 hover:text-green-700"
                    >
                      {notice.titleEn}
                    </Link>
                    <p className="text-xs text-ink-muted">/notices/{notice.slug}</p>
                  </td>
                  <td className="py-2 pr-4 text-ink-muted">{KIND_LABEL[notice.kind]}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={notice.status === "published" ? "green" : "muted"}>
                      {notice.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-ink-muted">
                    {notice.publishedOn ? shortDate(notice.publishedOn) : "not yet"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/notices/${notice.id}`}
                        className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100"
                      >
                        Edit
                      </Link>
                      {notice.status === "published" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => send(notice, { action: "unpublish" }, "Could not withdraw that notice.")}
                          className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100 disabled:opacity-40"
                        >
                          Withdraw
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => send(notice, { action: "publish" }, "Could not publish that notice.")}
                          className="rounded-[4px] bg-red-700 px-2 py-1 text-white hover:bg-red-700/90 disabled:opacity-40"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(notice)}
                        className="rounded-[4px] border border-line px-2 py-1 text-red-700 hover:bg-red-100 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

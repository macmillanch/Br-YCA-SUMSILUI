"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { STATUS_LABEL } from "@/lib/labels";
import { shortDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { AdminProject } from "@/lib/projects";

/**
 * The list a work is added from and corrected from. The progress column shows
 * what a visitor sees on the card — the percentage of the latest dated report —
 * because that is the figure the branch has committed to publicly.
 */
export function ProjectsTable({ projects }: { projects: AdminProject[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(project: AdminProject) {
    if (
      !window.confirm(
        `Remove "${project.title}" and its progress reports from the site? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(project.id);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("That work could not be removed. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network problem. Nothing was removed — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (projects.length === 0) {
    return (
      <p className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
        No work has been recorded yet. The first one entered appears on the public page at once.
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
          <caption className="sr-only">Works taken on by the branch</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-2 pr-4 font-medium">Work</th>
              <th scope="col" className="py-2 pr-4 font-medium">Status</th>
              <th scope="col" className="py-2 pr-4 font-medium">Sanctioned</th>
              <th scope="col" className="py-2 pr-4 font-medium">Latest report</th>
              <th scope="col" className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-line/60 align-middle">
                <td className="py-2 pr-4">
                  <Link
                    href={`/admin/works/${project.id}`}
                    className="font-medium text-green-900 hover:text-green-700"
                  >
                    {project.title}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    /works/{project.slug} · order {project.order}
                  </p>
                </td>
                <td className="py-2 pr-4">
                  <Badge tone={project.status === "deferred" ? "red" : "green"}>
                    {STATUS_LABEL[project.status]}
                  </Badge>
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  {project.sanctionedPaise > 0 ? formatPaise(project.sanctionedPaise) : "—"}
                </td>
                <td className="py-2 pr-4">
                  {project.percentComplete === null ? (
                    <span className="text-ink-muted">Not reported</span>
                  ) : (
                    <span className="tabular-nums">
                      {project.percentComplete}%
                      {project.reportedOn ? (
                        <span className="text-ink-muted"> · {shortDate(project.reportedOn)}</span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/works/${project.id}`}
                      className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === project.id}
                      onClick={() => remove(project)}
                      className="rounded-[4px] border border-line px-2 py-1 text-red-700 hover:bg-red-100 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

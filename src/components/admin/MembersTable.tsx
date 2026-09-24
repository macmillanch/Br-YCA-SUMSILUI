"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { MEMBER_TYPE_LABEL } from "@/lib/labels";
import type { AdminMember } from "@/lib/members";

/**
 * The list an office-bearer is added from and corrected from. The contact column
 * says what a visitor will see rather than what is stored, because the stored
 * number is the branch's own record and the visible one is a public act.
 */
export function MembersTable({ members }: { members: AdminMember[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(member: AdminMember) {
    if (!window.confirm(`Remove ${member.name} from the list? This cannot be undone.`)) return;
    setBusyId(member.id);
    setError(null);
    try {
      const response = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("That record could not be removed. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network problem. Nothing was removed — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (members.length === 0) {
    return (
      <p className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
        No one has been added yet. The first name entered will appear on the public page at once.
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
          <caption className="sr-only">Members of the branch</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-2 pr-4 font-medium">Name</th>
              <th scope="col" className="py-2 pr-4 font-medium">Listed in</th>
              <th scope="col" className="py-2 pr-4 font-medium">Position</th>
              <th scope="col" className="py-2 pr-4 font-medium">Term</th>
              <th scope="col" className="py-2 pr-4 font-medium">Contact on the site</th>
              <th scope="col" className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-line/60 align-middle">
                <td className="py-2 pr-4">
                  <Link
                    href={`/admin/members/${member.id}`}
                    className="font-medium text-green-900 hover:text-green-700"
                  >
                    {member.name}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    Order {member.order}
                    {member.current ? "" : " · past office"}
                  </p>
                </td>
                <td className="py-2 pr-4 text-ink-muted">{MEMBER_TYPE_LABEL[member.memberType]}</td>
                <td className="py-2 pr-4">{member.position ?? <span className="text-ink-muted">—</span>}</td>
                <td className="py-2 pr-4 text-ink-muted">{member.term ?? "—"}</td>
                <td className="py-2 pr-4">
                  <Badge tone={member.showContactPublicly ? "green" : "muted"}>
                    {member.showContactPublicly ? (member.phone ? "Phone shown" : "No phone stored") : "Hidden"}
                  </Badge>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/members/${member.id}`}
                      className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === member.id}
                      onClick={() => remove(member)}
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

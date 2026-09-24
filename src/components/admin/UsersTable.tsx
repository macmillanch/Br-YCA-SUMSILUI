"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABEL, type PublicUser, type Role } from "@/lib/types";

const ROLE_OPTIONS: Role[] = ["editor", "treasurer", "super_admin"];

export function UsersTable({
  users,
  currentUserId,
}: {
  users: PublicUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: { active?: boolean; role?: Role }) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const parsed = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(parsed?.error?.message ?? "Could not update that account.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network problem. Nothing was changed — please try again.");
    } finally {
      setBusyId(null);
    }
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
          <caption className="sr-only">Office-bearer accounts</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-2 pr-4 font-medium">Name</th>
              <th scope="col" className="py-2 pr-4 font-medium">Email</th>
              <th scope="col" className="py-2 pr-4 font-medium">Role</th>
              <th scope="col" className="py-2 pr-4 font-medium">Last sign-in</th>
              <th scope="col" className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = busyId === user.id;
              return (
                <tr key={user.id} className="border-b border-line/60 align-middle">
                  <td className="py-2 pr-4">
                    {user.name}
                    {isSelf ? <span className="ml-1 text-xs text-ink-muted">(you)</span> : null}
                  </td>
                  <td className="py-2 pr-4 text-ink-muted">{user.email}</td>
                  <td className="py-2 pr-4">
                    <label className="sr-only" htmlFor={`role-${user.id}`}>
                      Role for {user.name}
                    </label>
                    <select
                      id={`role-${user.id}`}
                      value={user.role}
                      disabled={isSelf || busy}
                      onChange={(event) => patch(user.id, { role: event.target.value as Role })}
                      className="rounded-[4px] border border-line bg-paper px-2 py-1 text-sm disabled:opacity-40"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4 text-ink-muted">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString("en-IN")
                      : "never"}
                  </td>
                  <td className="py-2">
                    <span
                      className={`mr-3 text-xs ${user.active ? "text-green-700" : "text-red-700"}`}
                    >
                      {user.active ? "Active" : "Deactivated"}
                    </span>
                    <button
                      type="button"
                      disabled={isSelf || busy}
                      onClick={() => patch(user.id, { active: !user.active })}
                      title={
                        isSelf ? "You cannot change your own account" : "Takes effect immediately"
                      }
                      className="rounded-[4px] border border-line px-2 py-1 text-green-900 hover:bg-green-100 disabled:opacity-40"
                    >
                      {busy ? "Working" : user.active ? "Deactivate" : "Reactivate"}
                    </button>
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

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { InviteUserForm } from "@/components/admin/InviteUserForm";
import { UsersTable } from "@/components/admin/UsersTable";
import { listUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Users", robots: { index: false } };

export default async function UsersPage() {
  const store = await cookies();
  const ctx = await resolveSession(store.get(SESSION_COOKIE)?.value ?? "");
  if (!ctx) return null;

  // The API already refuses a non-super-admin, but this page reads the list
  // server-side, so the gate has to be here too or the HTML would leak emails.
  if (ctx.user.role !== "super_admin") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl">Users</h1>
        <p className="text-sm text-ink-muted">
          Only a super-admin can see or change office-bearer accounts. Ask a super-admin to change
          your role or deactivate an account.
        </p>
      </div>
    );
  }

  const users = await listUsers();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl">Users</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Deactivating an account signs it out on its next request. You cannot change your own role
          or deactivate yourself, so keep at least two super-admin accounts.
        </p>
      </div>

      <UsersTable users={users} currentUserId={ctx.user._id.toHexString()} />

      <div>
        <h2 className="text-lg">Invite an office-bearer</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          The temporary password is generated here and shown once. Nothing is emailed, so there is no
          mail server to compromise.
        </p>
        <InviteUserForm />
      </div>
    </div>
  );
}

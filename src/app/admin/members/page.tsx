import type { Metadata } from "next";
import { MembersTable } from "@/components/admin/MembersTable";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { Button } from "@/components/ui/Button";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { listMembers, MANAGE_MEMBERS, toAdminMember } from "@/lib/members";

export const metadata: Metadata = { title: "Members", robots: { index: false } };

export default async function AdminMembersPage() {
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_MEMBERS)) {
    return (
      <NotPermitted
        title="Members"
        body="The member list is kept by the office-bearers who hold accounts, not by every admin account."
      />
    );
  }

  const members = (await listMembers()).map(toAdminMember);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Members</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Office-bearers, executive members, the advisory board and the community register. A saved
            name appears on the public page at once; a phone number appears only where that person has
            agreed to be contacted.
          </p>
        </div>
        <Button href="/admin/members/new">Add a member</Button>
      </div>

      <MembersTable members={members} />
    </div>
  );
}

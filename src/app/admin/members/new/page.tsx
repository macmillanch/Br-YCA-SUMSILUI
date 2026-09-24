import type { Metadata } from "next";
import { MemberForm } from "@/components/admin/MemberForm";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { MANAGE_MEMBERS } from "@/lib/members";

export const metadata: Metadata = { title: "Add a member", robots: { index: false } };

export default async function NewMemberPage() {
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_MEMBERS)) {
    return (
      <NotPermitted
        title="Add a member"
        body="The member list is kept by the office-bearers who hold accounts, not by every admin account."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Add a member</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Only the name and the list they belong to are needed. Everything else can be filled in later,
          and anything left blank simply does not appear on the site.
        </p>
      </div>
      <MemberForm />
    </div>
  );
}

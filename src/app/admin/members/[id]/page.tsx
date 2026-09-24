import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemberForm } from "@/components/admin/MemberForm";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { toObjectId } from "@/lib/mongo-oid";
import { getMember, MANAGE_MEMBERS, toFormValues } from "@/lib/members";

export const metadata: Metadata = { title: "Edit member", robots: { index: false } };

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_MEMBERS)) {
    return (
      <NotPermitted
        title="Edit member"
        body="The member list is kept by the office-bearers who hold accounts, not by every admin account."
      />
    );
  }

  const memberId = toObjectId(id);
  if (!memberId) notFound();
  const doc = await getMember(memberId);
  if (!doc) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">{doc.name}</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Saving changes what the public page shows the next time someone opens it.
        </p>
      </div>
      <MemberForm memberId={id} initial={toFormValues(doc)} />
    </div>
  );
}

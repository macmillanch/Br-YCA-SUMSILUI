import type { Metadata } from "next";
import { NoticeForm } from "@/components/admin/NoticeForm";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";

export const metadata: Metadata = { title: "New notice", robots: { index: false } };

export default async function NewNoticePage() {
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, ["editor"])) {
    return (
      <NotPermitted
        title="Write a notice"
        body="Only an editor writes notices. Ask an editor, or a super-admin to change your role."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Write a notice</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Save it as a draft to keep working on it. It reaches the public site only when you publish.
        </p>
      </div>
      <NoticeForm />
    </div>
  );
}

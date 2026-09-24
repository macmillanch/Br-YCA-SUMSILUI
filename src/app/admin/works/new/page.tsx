import type { Metadata } from "next";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { ProjectForm } from "@/components/admin/ProjectForm";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { MANAGE_WORKS } from "@/lib/projects";

export const metadata: Metadata = { title: "Record a work", robots: { index: false } };

export default async function NewWorkPage() {
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_WORKS)) {
    return (
      <NotPermitted
        title="Record a work"
        body="Works and their progress reports are recorded by the office-bearers and the Treasurer, not by every admin account."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Record a work</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Only the name and what it is for are needed to start. The sanctioned amount is the branch's
          own figure; what has been spent against it comes from the accounts, not from this form.
        </p>
      </div>
      <ProjectForm />
    </div>
  );
}

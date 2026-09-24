import type { Metadata } from "next";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { ProjectsTable } from "@/components/admin/ProjectsTable";
import { Button } from "@/components/ui/Button";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { MANAGE_WORKS, adminProjectRows } from "@/lib/projects";

export const metadata: Metadata = { title: "Works", robots: { index: false } };

export default async function AdminWorksPage() {
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_WORKS)) {
    return (
      <NotPermitted
        title="Works"
        body="Works and their progress reports are recorded by the office-bearers and the Treasurer, not by every admin account."
      />
    );
  }

  const projects = await adminProjectRows();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Works and progress</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            A work appears on the public page as soon as it is recorded. Its progress bar follows the
            latest dated report, so a work nobody has visited has no bar at all rather than an empty
            one.
          </p>
        </div>
        <Button href="/admin/works/new">Record a work</Button>
      </div>

      <ProjectsTable projects={projects} />
    </div>
  );
}

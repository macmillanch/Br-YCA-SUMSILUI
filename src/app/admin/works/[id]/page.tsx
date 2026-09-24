import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { ProjectForm } from "@/components/admin/ProjectForm";
import { ProjectUpdates } from "@/components/admin/ProjectUpdates";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { toObjectId } from "@/lib/mongo-oid";
import {
  MANAGE_WORKS,
  getProject,
  listProjectUpdates,
  sortUpdatesNewestFirst,
  toAdminProjectUpdate,
  toProjectFormValues,
} from "@/lib/projects";

export const metadata: Metadata = { title: "Edit work", robots: { index: false } };

export default async function EditWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_WORKS)) {
    return (
      <NotPermitted
        title="Edit work"
        body="Works and their progress reports are recorded by the office-bearers and the Treasurer, not by every admin account."
      />
    );
  }

  const projectId = toObjectId(id);
  if (!projectId) notFound();
  const doc = await getProject(projectId);
  if (!doc) notFound();

  const updates = sortUpdatesNewestFirst(await listProjectUpdates(projectId)).map(
    toAdminProjectUpdate,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Edit work</h1>
          <p className="mt-1 text-sm text-ink-muted">
            On the site at{" "}
            <Link
              href={`/works/${doc.slug}`}
              className="text-green-700 underline underline-offset-2"
            >
              /works/{doc.slug}
            </Link>
          </p>
        </div>
      </div>

      <ProjectForm projectId={id} initial={toProjectFormValues(doc)} />

      <ProjectUpdates projectId={id} updates={updates} />
    </div>
  );
}

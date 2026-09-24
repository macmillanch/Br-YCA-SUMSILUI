import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateWorks } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";
import {
  MANAGE_WORKS,
  buildProjectDoc,
  getProject,
  latestUpdateOf,
  listProjectUpdates,
  removeProjectWithUpdates,
  replaceProject,
  toAdminProject,
} from "@/lib/projects";
import { PROJECT_SCHEMA } from "@/lib/validation/projects";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const projectId = requireObjectId(id);

    return await requireRole(request, MANAGE_WORKS, async () => {
      const parsed = PROJECT_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const existing = await getProject(projectId);
      if (!existing) return fail(404, "not_found", "No such work.");

      const doc = buildProjectDoc(parsed.data, existing);
      const result = await replaceProject(doc);
      if (result === "duplicate_slug") {
        return fail(409, "duplicate_slug", "That web address is already used by another work.", {
          slug: "That web address is already used",
        });
      }
      if (result === "not_found") return fail(404, "not_found", "No such work.");

      // A renamed address has to be cleared at both ends, and the card on the
      // list changes with it.
      invalidateWorks(existing.slug);
      invalidateWorks(doc.slug);

      const reports = await listProjectUpdates(doc._id);
      return ok({ project: toAdminProject(doc, latestUpdateOf(reports)) });
    });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const projectId = requireObjectId(id);

    return await requireRole(request, MANAGE_WORKS, async () => {
      const removed = await removeProjectWithUpdates(projectId);
      if (!removed.removed) return fail(404, "not_found", "No such work.");
      if (removed.slug) invalidateWorks(removed.slug);
      return ok({
        removed: true,
        updatesRemoved: removed.updatesRemoved,
        deleted: projectId.toHexString(),
      });
    });
  } catch (error) {
    return fromError(error);
  }
}

import type { NextRequest } from "next/server";
import { fail, fromError, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateWorks } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";
import { MANAGE_WORKS, deleteProjectUpdate, getProject, getProjectUpdate } from "@/lib/projects";

/**
 * A dated report is a public claim about a real work, so a wrong one has to be
 * takeable — but not edited. The record of what the branch believed on 10
 * August stays what it was; a correction is a new line with a new date.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; updateId: string }> },
) {
  try {
    const { id, updateId } = await context.params;
    const projectId = requireObjectId(id);
    const reportId = requireObjectId(updateId, "updateId");

    return await requireRole(request, MANAGE_WORKS, async () => {
      const project = await getProject(projectId);
      if (!project) return fail(404, "not_found", "No such work.");

      const existing = await getProjectUpdate(projectId, reportId);
      if (!existing) return fail(404, "not_found", "No such report on this work.");

      await deleteProjectUpdate(projectId, reportId);
      invalidateWorks(project.slug);
      return ok({ deleted: existing._id.toHexString() });
    });
  } catch (error) {
    return fromError(error);
  }
}

import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateWorks } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";
import {
  MANAGE_WORKS,
  buildProjectUpdateDoc,
  getProject,
  insertProjectUpdate,
  toAdminProjectUpdate,
} from "@/lib/projects";
import { PROJECT_UPDATE_SCHEMA } from "@/lib/validation/projects";

/**
 * Reports are added one at a time, from the work's own screen — a progress line
 * belongs to a work that already exists, and its date is the branch's record of
 * what it saw on that day, so the form never edits one in place. Correcting a
 * wrong report means removing it and adding the true one.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const projectId = requireObjectId(id);

    return await requireRole(request, MANAGE_WORKS, async () => {
      const parsed = PROJECT_UPDATE_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const project = await getProject(projectId);
      if (!project) return fail(404, "not_found", "No such work.");

      const doc = buildProjectUpdateDoc(parsed.data, projectId);
      await insertProjectUpdate(doc);

      invalidateWorks(project.slug);
      return ok({ update: toAdminProjectUpdate(doc) });
    });
  } catch (error) {
    return fromError(error);
  }
}

import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateWorks } from "@/lib/invalidate";
import {
  MANAGE_WORKS,
  buildProjectDoc,
  insertProject,
  toAdminProject,
} from "@/lib/projects";
import { PROJECT_SCHEMA } from "@/lib/validation/projects";

export async function POST(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_WORKS, async () => {
      const parsed = PROJECT_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const doc = buildProjectDoc(parsed.data);
      const result = await insertProject(doc);
      if (result === "duplicate_slug") {
        return fail(409, "duplicate_slug", "That web address is already used by another work.", {
          slug: "That web address is already used",
        });
      }

      invalidateWorks(doc.slug);
      return ok({ project: toAdminProject(doc, null) });
    });
  } catch (error) {
    return fromError(error);
  }
}

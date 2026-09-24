import type { NextRequest } from "next/server";
import { fail, fromError, ok } from "@/lib/api-response";
import { destroySessionsForUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/require-role";
import { requireObjectId } from "@/lib/mongo-oid";
import { findUserById, setUserActive, setUserRole, toPublicUser } from "@/lib/users";
import { USER_PATCH_SCHEMA } from "@/lib/validation/users";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    // [] = super_admin only
    return await requireRole(request, [], async ({ user: actor }) => {
      const targetId = requireObjectId(id);
      const parsed = USER_PATCH_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        const fieldErrors = Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join(".") || "form", issue.message]),
        );
        return fail(400, "validation_failed", "Some fields need attention", fieldErrors);
      }

      if (targetId.equals(actor._id)) {
        return fail(409, "self_change", "You cannot change your own role or deactivate yourself.");
      }

      const target = await findUserById(targetId);
      if (!target) return fail(404, "not_found", "No such account.");

      if (parsed.data.role) await setUserRole(targetId, parsed.data.role);
      if (parsed.data.active !== undefined) await setUserActive(targetId, parsed.data.active);
      if (parsed.data.active === false) {
        // The cut-off has to bite on the target's next request, not when their
        // cookie happens to reach its fourteen-day expiry.
        await destroySessionsForUser(targetId);
      }

      const updated = await findUserById(targetId);
      if (!updated) return fail(404, "not_found", "No such account.");
      return ok({ user: toPublicUser(updated) });
    });
  } catch (error) {
    return fromError(error);
  }
}

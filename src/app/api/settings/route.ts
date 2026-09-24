import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { fail, fromError, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { toObjectId } from "@/lib/mongo-oid";
import { SETTINGS_SCHEMA, getSettings, upsertSettings } from "@/lib/settings";

export async function GET(request: NextRequest) {
  try {
    return await requireRole(request, ["editor", "treasurer"], async () =>
      ok({ settings: await getSettings() }),
    );
  } catch (error) {
    return fromError(error);
  }
}

/**
 * The empty allowlist is the super-admin-only convention from `canAccess`.
 * This is the enforcement point for settings — the screen renders for anyone
 * signed in, and the server decides.
 */
export async function PATCH(request: NextRequest) {
  try {
    return await requireRole(request, [], async ({ user }) => {
      const body = await request.json().catch(() => null);
      const parsed = SETTINGS_SCHEMA.safeParse(body);
      if (!parsed.success) {
        const fieldErrors = Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join(".") || "form", issue.message]),
        );
        return fail(400, "validation_failed", "Some fields need attention", fieldErrors);
      }

      const saved = await upsertSettings(parsed.data, toObjectId(user._id));
      // Every public page carries the footer, so a corrected phone number has
      // to clear their cached HTML or it stays wrong for the revalidate window.
      revalidatePath("/", "layout");
      return ok({ settings: saved });
    });
  } catch (error) {
    return fromError(error);
  }
}

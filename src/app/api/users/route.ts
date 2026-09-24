import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { generateTemporaryPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/require-role";
import { createUser, findUserByEmail, listUsers, toPublicUser } from "@/lib/users";
import { INVITE_SCHEMA } from "@/lib/validation/users";

export async function GET(request: NextRequest) {
  try {
    // [] = super_admin only
    return await requireRole(request, [], async () => ok({ users: await listUsers() }));
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // [] = super_admin only
    return await requireRole(request, [], async () => {
      const parsed = INVITE_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const { email, name, role, phone, password } = parsed.data;
      if (await findUserByEmail(email)) {
        return fail(409, "duplicate_email", "That email already has an account.");
      }

      // Shown once in the response body and never stored in plain text: the
      // super-admin reads it off the screen and hands it over in person.
      const temporaryPassword = password ?? generateTemporaryPassword();
      const created = await createUser({
        email,
        name,
        role,
        phone,
        password: temporaryPassword,
      });

      return ok({ user: toPublicUser(created), temporaryPassword });
    });
  } catch (error) {
    return fromError(error);
  }
}

import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateMembers } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";
import {
  buildMemberDoc,
  deleteMember,
  getMember,
  MANAGE_MEMBERS,
  replaceMember,
  toAdminMember,
} from "@/lib/members";
import { MEMBER_SCHEMA } from "@/lib/validation/members";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await requireRole(request, MANAGE_MEMBERS, async () => {
      const doc = await getMember(requireObjectId(id));
      if (!doc) return fail(404, "not_found", "No such member.");
      return ok({ member: toAdminMember(doc) });
    });
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const memberId = requireObjectId(id);

    return await requireRole(request, MANAGE_MEMBERS, async () => {
      const parsed = MEMBER_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const existing = await getMember(memberId);
      if (!existing) return fail(404, "not_found", "No such member.");

      const doc = buildMemberDoc(parsed.data, existing);
      await replaceMember(doc);
      invalidateMembers();
      return ok({ member: toAdminMember(doc) });
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
    const memberId = requireObjectId(id);

    return await requireRole(request, MANAGE_MEMBERS, async () => {
      if (!(await deleteMember(memberId))) return fail(404, "not_found", "No such member.");
      invalidateMembers();
      return ok({ deleted: memberId.toHexString() });
    });
  } catch (error) {
    return fromError(error);
  }
}

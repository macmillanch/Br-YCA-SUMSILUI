import type { NextRequest } from "next/server";
import { fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateMembers } from "@/lib/invalidate";
import {
  buildMemberDoc,
  insertMember,
  listMembers,
  MANAGE_MEMBERS,
  toAdminMember,
} from "@/lib/members";
import { MEMBER_SCHEMA, MEMBER_TYPE_QUERY_SCHEMA } from "@/lib/validation/members";

export async function GET(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_MEMBERS, async () => {
      const memberType = MEMBER_TYPE_QUERY_SCHEMA.safeParse(
        request.nextUrl.searchParams.get("memberType"),
      ).data;
      const members = await listMembers(memberType ? { memberType } : {});
      return ok({ members: members.map(toAdminMember) });
    });
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_MEMBERS, async () => {
      const parsed = MEMBER_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const doc = buildMemberDoc(parsed.data);
      await insertMember(doc);
      invalidateMembers();
      return ok({ member: toAdminMember(doc) });
    });
  } catch (error) {
    return fromError(error);
  }
}

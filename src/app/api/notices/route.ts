import type { NextRequest } from "next/server";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateNotices } from "@/lib/invalidate";
import {
  buildNoticeDoc,
  insertNotice,
  listNotices,
  toAdminNotice,
} from "@/lib/notices";
import type { NoticeKind, NoticeStatus } from "@/lib/types";
import { NOTICE_SCHEMA } from "@/lib/validation/notices";

const KINDS: readonly string[] = ["notice", "press_release", "announcement"];
const STATUSES: readonly string[] = ["draft", "published"];

function enumParam<T extends string>(value: string | null, allowed: readonly string[]): T | undefined {
  return value && allowed.includes(value) ? (value as T) : undefined;
}

/** Editors only: a treasurer's screen has no reason to read draft notices. */
export async function GET(request: NextRequest) {
  try {
    return await requireRole(request, ["editor"], async () => {
      const params = request.nextUrl.searchParams;
      const notices = await listNotices({
        kind: enumParam<NoticeKind>(params.get("kind"), KINDS),
        status: enumParam<NoticeStatus>(params.get("status"), STATUSES),
      });
      return ok({ notices: notices.map(toAdminNotice) });
    });
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await requireRole(request, ["editor"], async ({ user }) => {
      const parsed = NOTICE_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const doc = buildNoticeDoc(parsed.data, user._id);
      const result = await insertNotice(doc);
      if (result === "duplicate_slug") {
        return fail(409, "duplicate_slug", "That web address is already used.", {
          slug: "That web address is already used",
        });
      }

      invalidateNotices(doc.slug);
      return ok({ notice: toAdminNotice(doc) });
    });
  } catch (error) {
    return fromError(error);
  }
}

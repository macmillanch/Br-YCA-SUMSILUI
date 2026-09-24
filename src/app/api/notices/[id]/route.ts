import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateNotices } from "@/lib/invalidate";
import { requireObjectId } from "@/lib/mongo-oid";
import {
  buildNoticeDoc,
  deleteNotice,
  getNotice,
  replaceNotice,
  setNoticeStatus,
  toAdminNotice,
} from "@/lib/notices";
import { NOTICE_SCHEMA } from "@/lib/validation/notices";

/** The list's Publish and Withdraw buttons, sent without the whole document. */
const ACTION_SCHEMA = z.object({ action: z.enum(["publish", "unpublish"]) });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await requireRole(request, ["editor"], async () => {
      const doc = await getNotice(requireObjectId(id));
      if (!doc) return fail(404, "not_found", "No such notice.");
      return ok({ notice: toAdminNotice(doc) });
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
    const noticeId = requireObjectId(id);

    return await requireRole(request, ["editor"], async ({ user }) => {
      const body = await request.json().catch(() => null);

      // One endpoint, two shapes: a form saves everything it was showing, and a
      // row's button saves only the status change it asked for.
      if (body && typeof body === "object" && "action" in body) {
        const action = ACTION_SCHEMA.safeParse(body);
        if (!action.success) return validationFail(action.error);

        const updated = await setNoticeStatus(
          noticeId,
          action.data.action === "publish" ? "published" : "draft",
        );
        if (!updated) return fail(404, "not_found", "No such notice.");
        invalidateNotices(updated.slug);
        return ok({ notice: toAdminNotice(updated) });
      }

      const parsed = NOTICE_SCHEMA.safeParse(body);
      if (!parsed.success) return validationFail(parsed.error);

      const existing = await getNotice(noticeId);
      if (!existing) return fail(404, "not_found", "No such notice.");

      const doc = buildNoticeDoc(parsed.data, user._id, existing);
      const result = await replaceNotice(doc);
      if (result === "duplicate_slug") {
        return fail(409, "duplicate_slug", "That web address is already used.", {
          slug: "That web address is already used",
        });
      }
      if (result === "not_found") return fail(404, "not_found", "No such notice.");

      // A renamed address has to be cleared at both ends: the old one stops
      // serving a page that no longer exists, the new one serves at once.
      invalidateNotices(existing.slug);
      invalidateNotices(doc.slug);
      return ok({ notice: toAdminNotice(doc) });
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
    const noticeId = requireObjectId(id);

    return await requireRole(request, ["editor"], async () => {
      const existing = await getNotice(noticeId);
      if (!existing) return fail(404, "not_found", "No such notice.");
      await deleteNotice(noticeId);
      invalidateNotices(existing.slug);
      return ok({ deleted: existing._id.toHexString() });
    });
  } catch (error) {
    return fromError(error);
  }
}

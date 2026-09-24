import type { NextRequest } from "next/server";
import { fail, fromError, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateGallery } from "@/lib/invalidate";
import { MANAGE_GALLERY, deleteGalleryDoc } from "@/lib/gallery";
import { requireObjectId } from "@/lib/mongo-oid";

/**
 * Taking one picture down. The photograph itself stays in the store — deleting a
 * row here is a decision about what the public page shows, not an erasure of the
 * branch's copy, which would be a far worse thing to do by an accidental click.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const itemId = requireObjectId(id);

    return await requireRole(request, MANAGE_GALLERY, async () => {
      const removed = await deleteGalleryDoc(itemId);
      if (!removed) return fail(404, "not_found", "No such picture.");
      invalidateGallery();
      return ok({ removed: true, deleted: itemId.toHexString() });
    });
  } catch (error) {
    return fromError(error);
  }
}

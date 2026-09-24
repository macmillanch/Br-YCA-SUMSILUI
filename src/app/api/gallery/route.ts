import type { NextRequest } from "next/server";
import { fromError, ok, validationFail } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import { invalidateGallery } from "@/lib/invalidate";
import { MANAGE_GALLERY, buildGalleryDoc, insertGalleryDoc, toAdminGalleryItem } from "@/lib/gallery";
import { GALLERY_ITEM_SCHEMA } from "@/lib/validation/gallery";

/**
 * A picture joins the gallery. The address in the body is the one the upload
 * returned, or the one an office-bearer pasted while the store is not yet
 * connected — either way the record is the branch's own words about a photograph
 * it has chosen to publish.
 */
export async function POST(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_GALLERY, async (ctx) => {
      const parsed = GALLERY_ITEM_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationFail(parsed.error);

      const doc = buildGalleryDoc(parsed.data, ctx.user._id);
      await insertGalleryDoc(doc);
      invalidateGallery();
      return ok({ item: toAdminGalleryItem(doc) });
    });
  } catch (error) {
    return fromError(error);
  }
}

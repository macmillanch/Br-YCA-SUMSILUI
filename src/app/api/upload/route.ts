import type { NextRequest } from "next/server";
import { fail, fromError, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/require-role";
import {
  MAX_UPLOAD_BYTES,
  detectImageKind,
  readCredentials,
  uploadRejection,
  uploadToCloudinary,
} from "@/lib/cloudinary";
import { MANAGE_GALLERY } from "@/lib/gallery";

/**
 * One picture, from an office-bearer's phone to the branch's image store.
 *
 * The order of the checks is the whole design. The file is measured and its
 * leading bytes are read before any credential is looked at, so a wrong file is
 * refused just as plainly when the store is connected as when it is not — and
 * nothing at all leaves the server until a real picture has been proven to be
 * one. The API secret is never read here; `uploadToCloudinary` signs with it and
 * the browser only ever sees the address that comes back.
 */

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LIMIT = `${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`;

export async function POST(request: NextRequest) {
  try {
    return await requireRole(request, MANAGE_GALLERY, async () => {
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File)) {
        return fail(400, "no_file", "Choose a picture file first.");
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const rejection = uploadRejection(bytes.byteLength, detectImageKind(bytes));

      if (rejection === "file_too_large") {
        return fail(
          413,
          "file_too_large",
          `A picture has to be ${LIMIT} or smaller. This one is ${megabytes(
            bytes.byteLength,
          )} — a phone photo resized is small enough for the page.`,
        );
      }
      if (rejection === "not_an_image") {
        return fail(
          400,
          "not_an_image",
          "That file is not a real JPEG, PNG or WebP picture, whatever it is called. Only photographs can be added.",
        );
      }
      if (!readCredentials()) {
        return fail(
          503,
          "upload_not_configured",
          "The branch has not connected its photo store yet, so this picture could not be kept. An office-bearer with the site's own keys can add them in the server settings, or the picture can be added by its web address.",
        );
      }

      const uploaded = await uploadToCloudinary(bytes);
      return ok(uploaded);
    });
  } catch (error) {
    return fromError(error);
  }
}

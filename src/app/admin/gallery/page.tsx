import type { Metadata } from "next";
import { GalleryList } from "@/components/admin/GalleryList";
import { GalleryUploader } from "@/components/admin/GalleryUploader";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { readCredentials } from "@/lib/cloudinary";
import { MANAGE_GALLERY, adminGalleryRows } from "@/lib/gallery";

export const metadata: Metadata = { title: "Gallery", robots: { index: false } };

export default async function AdminGalleryPage() {
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_GALLERY)) {
    return (
      <NotPermitted
        title="Gallery"
        body="Photographs are chosen and described by the office-bearers, not by every admin account."
      />
    );
  }

  const items = await adminGalleryRows();
  const configured = readCredentials() !== null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl">Gallery</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Every picture published here carries a caption and a description for someone using a
          screen reader. Thumbnails are served at display size, so a visitor on a phone data
          connection is not asked to download an original.
        </p>
      </div>

      {!configured ? (
        <p className="max-w-prose rounded-[12px] border border-line bg-paper-alt p-4 text-sm text-ink-muted">
          The branch&rsquo;s photo store is not connected on this server yet, so an uploaded file
          cannot be kept. A picture can still be added by its web address until the keys are in
          place &mdash; see <code className="text-ink">CLOUDINARY_*</code> in the deployment notes.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg text-green-900">Add a picture</h2>
        <GalleryUploader albumNames={[...new Set(items.map((item) => item.album))]} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg text-green-900">
          Published pictures ({items.length})
        </h2>
        <GalleryList items={items} />
      </section>
    </div>
  );
}

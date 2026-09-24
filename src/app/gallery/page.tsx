import type { Metadata } from "next";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { getGalleryAlbums } from "@/lib/content";
import { shortDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photographs of branch events and works, published with written descriptions.",
};

export const revalidate = 300;

const DESCRIPTION =
  "Photographs are grouped by album. Every picture carries a written description so that it reads properly for someone using a screen reader, and the copies shown here are served at display size rather than as full-resolution originals.";

export default async function GalleryPage() {
  const gallery = await getGalleryAlbums();

  return (
    <div className="container-page space-y-8 py-10">
      <PageHeader eyebrow="In pictures" title="Gallery" description={DESCRIPTION} />

      {gallery.state === "unavailable" ? <SectionUnavailable what="The photographs" /> : null}

      {gallery.state === "empty" ? (
        <EmptyState
          title="No albums published yet"
          body="Photographs from meetings, camps and works will be added here from Admin → Gallery. Each one is published with a caption and a description for people who cannot see it."
          action={{ href: "/admin/gallery", label: "Office-bearers: sign in to add pictures" }}
        />
      ) : null}

      {gallery.state === "ready"
        ? gallery.items.map((album) => (
            <section key={album.album} aria-label={album.album} className="space-y-4">
              <h2 className="border-b border-line pb-2 text-xl sm:text-[22px]">{album.album}</h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {album.items.map((photo) => (
                  <li key={`${photo.album}-${photo.imageUrl}`}>
                    <figure className="overflow-hidden rounded-[12px] border border-line">
                      <img
                        src={photo.thumbUrl}
                        alt={photo.alt}
                        width={600}
                        height={450}
                        loading="lazy"
                        className="aspect-[4/3] w-full bg-paper-alt object-cover"
                      />
                      <figcaption className="space-y-1 px-3 py-2">
                        <p className="text-sm leading-6">{photo.caption}</p>
                        {photo.takenAt ? (
                          <p className="text-xs text-ink-muted">{shortDate(photo.takenAt)}</p>
                        ) : null}
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            </section>
          ))
        : null}
    </div>
  );
}

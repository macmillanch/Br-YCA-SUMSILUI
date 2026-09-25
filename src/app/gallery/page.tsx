import type { Metadata } from "next";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { PhotoViewer, type ViewerPhoto } from "@/components/site/PhotoViewer";
import { getGalleryAlbums } from "@/lib/content";
import type { GalleryAlbum, PublicGalleryItem } from "@/lib/gallery";
import { shortDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photographs of branch events and works, published with written descriptions.",
};

export const revalidate = 300;

const DESCRIPTION =
  "Photographs are grouped by album, and each one is published with a caption and a written description so that it reads properly for someone using a screen reader. Click a picture to open it larger; the copies shown here are served at display size rather than as full-resolution originals.";

function viewerPhotoFor(photo: PublicGalleryItem): ViewerPhoto {
  return {
    url: photo.fullUrl,
    alt: photo.alt,
    caption: photo.caption,
    album: photo.album,
    takenAt: photo.takenAt,
  };
}

/**
 * The pictures, numbered the way the page lists them: album by album, and within
 * an album in the order the branch numbered them.
 *
 * The numbering runs across the whole page rather than restarting at every album
 * because the viewer carries on past an album's border — a branch that publishes
 * one photograph per meeting should be able to walk through a year without
 * closing and reopening anything.
 */
function numberAlbums(albums: readonly GalleryAlbum[]) {
  let at = 0;
  return albums.map((album) => ({
    album: album.album,
    photos: album.items.map((photo) => ({ at: at++, photo })),
  }));
}

export default async function GalleryPage() {
  const gallery = await getGalleryAlbums();
  const albums = gallery.state === "ready" ? gallery.items : [];
  const sections = numberAlbums(albums);
  const photos = sections.flatMap((album) => album.photos.map(({ photo }) => viewerPhotoFor(photo)));

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

      {sections.map((album) => (
        <section key={album.album} aria-label={album.album} className="space-y-4">
          <h2 className="border-b border-line pb-2 text-xl sm:text-[22px]">{album.album}</h2>
          {/* Columns rather than a row grid: a photograph keeps its own shape, so
              a portrait stays tall instead of being cropped to match its
              neighbours, and the heads of the people in it stay in the picture. */}
          <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {album.photos.map(({ at, photo }) => (
              <li key={`${photo.album}-${photo.imageUrl}`} className="mb-5 break-inside-avoid">
                <figure className="overflow-hidden rounded-[12px] border border-line bg-paper-alt">
                  {/* A real link to the larger copy, which is where the viewer
                      opens from. The number is how it knows which picture. */}
                  <a href={photo.fullUrl} data-photo={at} className="block">
                    <img
                      src={photo.thumbUrl}
                      alt={photo.alt}
                      loading="lazy"
                      decoding="async"
                      className="w-full"
                    />
                  </a>
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
      ))}

      {photos.length > 0 ? <PhotoViewer photos={photos} /> : null}
    </div>
  );
}

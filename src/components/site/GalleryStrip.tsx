import { Button } from "@/components/ui/Button";
import { SectionUnavailable } from "@/components/site/EmptyState";
import type { GalleryPhoto } from "@/lib/content";

/**
 * The front-page strip. The address comes from the branch's image store, which
 * already serves a display-size copy, so the page asks for that one and leaves
 * the full-resolution original where it is.
 */
export function GalleryStrip({
  photos,
  unavailable,
}: {
  photos: readonly GalleryPhoto[];
  unavailable?: boolean;
}) {
  if (unavailable) return <SectionUnavailable what="The photographs" />;

  if (photos.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
        Photographs from branch events will appear here once they are uploaded in Admin &rarr;
        Gallery. Every photo is published with a written description so that it reads properly for
        people using a screen reader.
      </div>
    );
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo) => (
          <li key={photo.url} className="overflow-hidden rounded-[12px] border border-line">
            <img
              src={photo.thumbUrl}
              alt={photo.alt}
              width={600}
              height={450}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
            <p className="border-t border-line px-2 py-1 text-xs text-ink-muted">{photo.caption}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Button href="/gallery" variant="ghost">
          View gallery
        </Button>
      </div>
    </div>
  );
}

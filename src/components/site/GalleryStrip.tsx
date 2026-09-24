import Image from "next/image";
import { Button } from "@/components/ui/Button";
import type { GalleryPhoto } from "@/lib/content";

export function GalleryStrip({ photos }: { photos: readonly GalleryPhoto[] }) {
  if (photos.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
        Photographs from branch events will appear here once they are uploaded in Admin &rarr; Gallery.
        Every photo is published with a written description so that it reads properly for people using
        a screen reader.
      </div>
    );
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo) => (
          <li key={photo.url} className="overflow-hidden rounded-[12px] border border-line">
            <Image
              src={photo.url}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
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

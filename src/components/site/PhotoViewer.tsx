"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shortDate } from "@/lib/dates";

/**
 * The larger copy of a published photograph, opened over the grid.
 *
 * Every picture on the page is already a link to this address, so the grid reads
 * and works with JavaScript switched off: this component only intercepts the
 * click and keeps the reader from losing their place. A `<dialog>` opened with
 * `showModal()` is what gives the Escape key, the focus trap and the return to
 * the thumbnail for free, rather than as three things to remember to rebuild.
 */
export type ViewerPhoto = {
  url: string;
  alt: string;
  caption: string;
  album: string;
  takenAt: string | null;
};

/** The number on each thumbnail's link, in the order the page lists them. */
function indexOfAnchor(anchor: HTMLAnchorElement): number {
  const at = Number(anchor.dataset.photo);
  return Number.isInteger(at) && at >= 0 ? at : -1;
}

export function PhotoViewer({ photos }: { photos: readonly ViewerPhoto[] }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  /** The thumbnail that was clicked, so closing leaves the reader on it. */
  const triggerRef = useRef<HTMLAnchorElement | null>(null);
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[data-photo]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const at = indexOfAnchor(anchor);
      // A number the page did not hand out is a link to a picture this viewer
      // knows nothing about, so it travels like any other link.
      if (at >= photos.length) return;
      event.preventDefault();
      triggerRef.current = anchor;
      setShown(at);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [photos.length]);

  const isOpen = shown !== null;
  const turn = useCallback(
    (delta: number) => {
      setShown((current) => {
        if (current === null) return current;
        const next = current + delta;
        return next < 0 || next >= photos.length ? current : next;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return undefined;
    if (!dialog.open) dialog.showModal();
    const onClose = () => {
      setShown(null);
      // The browser puts focus back on its own when it can; asking again is what
      // makes the reader land on their picture rather than the top of the page.
      triggerRef.current?.focus();
    };
    /**
     * The keys are read off the document rather than the dialog, because after a
     * picture is swapped out the focus can be on the dialog, on one of its
     * buttons, or nowhere in it at all — and a reader steering with the arrow
     * keys does not care which of those it is.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        turn(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        turn(-1);
      }
    };
    dialog.addEventListener("close", onClose);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("close", onClose);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, turn]);

  if (shown === null) return null;
  const photo: ViewerPhoto | undefined = photos[shown];
  if (!photo) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Photograph viewer"
      className="w-[min(1100px,94vw)] rounded-[12px] border border-line bg-paper p-4 backdrop:bg-black/70"
    >
      <figure className="space-y-3">
        {/* The original would be many times this size, so the store is asked for a
            copy wide enough to read the detail in without downloading the file. */}
        <img
          src={photo.url}
          alt={photo.alt}
          decoding="async"
          className="mx-auto max-h-[65vh] w-auto max-w-full rounded-[8px] bg-paper-alt object-contain"
        />
        <figcaption className="space-y-1 text-center">
          <p className="text-sm leading-6">{photo.caption}</p>
          <p className="text-xs text-ink-muted">
            {photo.album}
            {photo.takenAt ? ` · ${shortDate(photo.takenAt)}` : null}
          </p>
        </figcaption>
      </figure>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => turn(-1)}
          disabled={shown === 0}
          className="rounded-[4px] border border-line bg-paper px-3 py-1.5 text-sm min-h-11 disabled:opacity-50"
        >
          Previous picture
        </button>
        {/* Announced so a reader turning the pictures hears how far they have got. */}
        <p aria-live="polite" className="text-sm text-ink-muted tabular-nums">
          {shown + 1} of {photos.length}
        </p>
        <button
          type="button"
          onClick={() => turn(1)}
          disabled={shown === photos.length - 1}
          className="rounded-[4px] border border-line bg-paper px-3 py-1.5 text-sm min-h-11 disabled:opacity-50"
        >
          Next picture
        </button>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded-[4px] border border-green-700 bg-green-700 px-3 py-1.5 text-sm text-white min-h-11"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

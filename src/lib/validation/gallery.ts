import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";

/**
 * What the branch says about a photograph.
 *
 * `alt` is required rather than optional: a picture of a meeting is silent to a
 * screen reader, and an uncaptioned grid of thumbnails tells a visitor nothing
 * about what the branch did. The web address is a stored result of an upload, so
 * it is validated as an address and never typed by hand on the public pages.
 */

const text = (max: number) => z.string().trim().max(max);

export const GALLERY_ITEM_SCHEMA = z.object({
  album: z
    .string()
    .trim()
    .min(3, "Name the album the picture belongs to")
    .max(160, "Keep the album name under 160 characters"),
  caption: z
    .string()
    .trim()
    .min(3, "Say what the picture shows")
    .max(500, "Keep the caption under 500 characters"),
  alt: z
    .string()
    .trim()
    .min(3, "Describe the picture for someone who cannot see it")
    .max(300, "Keep the description under 300 characters"),
  /**
   * `url()` alone would accept `javascript:` and plain `http:`, and this address
   * is loaded by every visitor's browser. The store serves https, so nothing
   * less is a mistake rather than a policy.
   */
  imageUrl: z
    .string()
    .trim()
    .url("Add the picture through the upload screen")
    .refine((value) => value.startsWith("https://"), {
      message: "The picture address has to start with https://",
    }),
  /** Blank means the day is not known, which the page shows as no date at all. */
  takenAt: z
    .string()
    .trim()
    .max(10)
    .refine((value) => value === "" || isCalendarDate(value), {
      message: "Use the form 2026-09-24 for the day it was taken, or leave it empty",
    }),
  order: z.coerce.number().int("Order in the album is a whole number").min(0).max(9999),
});

export type GalleryItemInput = z.infer<typeof GALLERY_ITEM_SCHEMA>;

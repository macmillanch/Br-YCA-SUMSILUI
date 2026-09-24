import { ObjectId, type Filter } from "mongodb";
import { collection } from "@/lib/db";
import { COLLECTIONS } from "@/lib/index-specs";
import { thumbUrlFor } from "@/lib/cloudinary";
import type { GalleryItemDoc, Role } from "@/lib/types";
import type { GalleryItemInput } from "@/lib/validation/gallery";

/**
 * The photographs, and what the branch says each one shows.
 *
 * The pictures themselves live in the image store; this database holds only the
 * address and the words, which means a photograph can be replaced without
 * touching a page and a page can be rebuilt without touching a photograph.
 */

export const MANAGE_GALLERY: readonly Role[] = ["editor", "treasurer"];

export type PublicGalleryItem = {
  album: string;
  caption: string;
  alt: string;
  imageUrl: string;
  thumbUrl: string;
  takenAt: string | null;
};

export type GalleryAlbum = { album: string; items: PublicGalleryItem[] };

export type AdminGalleryItem = PublicGalleryItem & { id: string; order: number };

/** The driver stores an explicit `undefined` as `null`, so absent keys are dropped. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

export function buildGalleryDoc(
  input: GalleryItemInput,
  uploadedById: ObjectId | null,
  existing?: GalleryItemDoc,
): GalleryItemDoc {
  return compact<GalleryItemDoc>({
    _id: existing?._id ?? new ObjectId(),
    album: input.album,
    caption: input.caption,
    alt: input.alt,
    imageUrl: input.imageUrl,
    thumbUrl: thumbUrlFor(input.imageUrl),
    takenAt: input.takenAt === "" ? undefined : input.takenAt,
    eventId: null,
    order: input.order,
    uploadedById,
    createdAt: existing?.createdAt ?? new Date(),
  });
}

export function toPublicGalleryItem(doc: GalleryItemDoc): PublicGalleryItem {
  return {
    album: doc.album,
    caption: doc.caption,
    alt: doc.alt,
    imageUrl: doc.imageUrl,
    thumbUrl: doc.thumbUrl,
    takenAt: doc.takenAt ?? null,
  };
}

export function toAdminGalleryItem(doc: GalleryItemDoc): AdminGalleryItem {
  return { ...toPublicGalleryItem(doc), id: doc._id.toHexString(), order: doc.order };
}

/**
 * Albums in the order the branch filled them, pictures in the order it numbered
 * them. The grouping is done in memory because the index already returns the
 * rows sorted by album and order, so no second pass is needed to keep them
 * together.
 */
export function groupByAlbum(docs: readonly GalleryItemDoc[]): GalleryAlbum[] {
  const albums = new Map<string, PublicGalleryItem[]>();
  for (const doc of [...docs].sort((a, b) => a.order - b.order)) {
    const items = albums.get(doc.album) ?? [];
    items.push(toPublicGalleryItem(doc));
    albums.set(doc.album, items);
  }
  return [...albums.entries()].map(([album, items]) => ({ album, items }));
}

export async function insertGalleryDoc(doc: GalleryItemDoc): Promise<void> {
  const items = await collection<GalleryItemDoc>(COLLECTIONS.galleryItems);
  await items.insertOne(doc);
}

export async function replaceGalleryDoc(doc: GalleryItemDoc): Promise<boolean> {
  const items = await collection<GalleryItemDoc>(COLLECTIONS.galleryItems);
  const result = await items.replaceOne({ _id: doc._id }, doc);
  return result.matchedCount > 0;
}

export async function getGalleryDoc(id: ObjectId): Promise<GalleryItemDoc | null> {
  const items = await collection<GalleryItemDoc>(COLLECTIONS.galleryItems);
  return items.findOne({ _id: id });
}

export async function deleteGalleryDoc(id: ObjectId): Promise<boolean> {
  const items = await collection<GalleryItemDoc>(COLLECTIONS.galleryItems);
  return (await items.deleteOne({ _id: id })).deletedCount > 0;
}

export async function listGalleryDocs(album?: string): Promise<GalleryItemDoc[]> {
  const items = await collection<GalleryItemDoc>(COLLECTIONS.galleryItems);
  const query: Filter<GalleryItemDoc> = album ? { album } : {};
  return items.find(query).sort({ album: 1, order: 1, createdAt: 1 }).limit(500).toArray();
}

export async function adminGalleryRows(album?: string): Promise<AdminGalleryItem[]> {
  return (await listGalleryDocs(album)).map(toAdminGalleryItem);
}

/** Every picture, grouped — the shape `/gallery` renders. */
export async function galleryAlbums(): Promise<GalleryAlbum[]> {
  return groupByAlbum(await listGalleryDocs());
}

/** The most recent few, for the front-page strip and the pages that link to the gallery. */
export async function recentGalleryItems(limit = 6): Promise<PublicGalleryItem[]> {
  const items = await collection<GalleryItemDoc>(COLLECTIONS.galleryItems);
  const docs = await items.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(toPublicGalleryItem);
}

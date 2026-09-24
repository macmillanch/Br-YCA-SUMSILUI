import { revalidatePath } from "next/cache";

/**
 * Public pages are cached so a visitor does not wait on MongoDB. That only
 * works if a write clears the pages that show what it changed — cached HTML
 * still saying "nothing published" after an editor has published is worse than
 * no caching at all, so each write clears exactly the paths that read it.
 */

export function invalidateNotices(slug?: string): void {
  revalidatePath("/notices");
  revalidatePath("/press-releases");
  revalidatePath("/");
  if (slug) revalidatePath(`/notices/${slug}`);
}

export function invalidateMembers(): void {
  revalidatePath("/executive-members");
  revalidatePath("/members");
}

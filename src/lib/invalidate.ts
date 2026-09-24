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

/**
 * A progress report changes two pages at once: the work's own timeline and the
 * card on the works list, whose bar reads the latest report. The homepage shows
 * the same cards, so it goes too.
 */
export function invalidateWorks(slug?: string): void {
  revalidatePath("/works");
  revalidatePath("/");
  if (slug) revalidatePath(`/works/${slug}`);
}

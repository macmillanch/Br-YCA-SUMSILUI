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

/**
 * A picture appears in its album on the gallery page and in the strip on the
 * front page, so both clear together. The album is not a page of its own, which
 * is why one path covers the whole gallery.
 */
export function invalidateGallery(): void {
  revalidatePath("/gallery");
  revalidatePath("/");
}

/**
 * A voucher changes the year's totals, the category breakdown, the ledger page
 * and the front-page summary, so all of them clear together. `/works` is here
 * because a work's spent figure is summed from these same entries, and a page
 * still showing the old total after a correction is the failure this whole
 * module exists to prevent.
 */
export function invalidateFinance(): void {
  revalidatePath("/finance");
  revalidatePath("/finance/[year]", "page");
  revalidatePath("/donate");
  revalidatePath("/works");
  revalidatePath("/works/[slug]", "page");
  revalidatePath("/");
}

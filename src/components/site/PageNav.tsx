import Link from "next/link";
import type { PageInfo } from "@/lib/pagination";

/**
 * The two links a paged list needs, and the one sentence that tells a reader
 * where they are in it.
 *
 * The dead direction is rendered as text rather than a disabled button: on a
 * notice board read on a phone, a link that goes nowhere is worse than no link,
 * and a greyed button a reader cannot tell apart from a live one is the same
 * problem with extra steps.
 */
export function PageNav({
  info,
  hrefFor,
  label,
}: {
  info: PageInfo;
  hrefFor: (page: number) => string;
  label: string;
}) {
  if (info.lastPage <= 1) return null;

  const link = "rounded-[4px] border border-green-700 bg-green-100 px-3 py-1.5 text-green-900 hover:bg-green-500 hover:text-white";
  const spent = "rounded-[4px] border border-line px-3 py-1.5 text-ink-muted";

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3 text-sm">
      {info.prevPage === null ? (
        <span className={spent}>Previous page</span>
      ) : (
        <Link href={hrefFor(info.prevPage)} rel="prev" className={link}>
          Previous page
        </Link>
      )}
      <span className="tabular-nums text-ink-muted">
        Page {info.page} of {info.lastPage} &middot; showing {info.from}&ndash;{info.to} of {info.total}
      </span>
      {info.nextPage === null ? (
        <span className={spent}>Next page</span>
      ) : (
        <Link href={hrefFor(info.nextPage)} rel="next" className={link}>
          Next page
        </Link>
      )}
    </nav>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { NoticeCard } from "@/components/site/NoticeCard";
import { PageNav } from "@/components/site/PageNav";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { getNoticesPage, KIND_LABEL, type NoticeKind } from "@/lib/content";
import { parsePageParam } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Notices",
  description:
    "Meeting notices, announcements and press releases issued by Young Chakma Association, Sumsilui Branch.",
};

const KINDS: readonly NoticeKind[] = ["notice", "announcement", "press_release"];

/** A board read on a phone: enough to scroll through, not a year in one screen. */
const PER_PAGE = 20;

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const { kind } = params;
  const active = KINDS.includes(kind as NoticeKind) ? (kind as NoticeKind) : undefined;
  const read = await getNoticesPage(active, parsePageParam(params), PER_PAGE);

  // A filter is a different question, so it starts the answer from the top; the
  // page number only travels within the filter it was asked for.
  const hrefFor = (item: NoticeKind | undefined, page: number) => {
    const query = new URLSearchParams();
    if (item) query.set("kind", item);
    if (page > 1) query.set("page", String(page));
    const text = query.toString();
    return text ? `/notices?${text}` : "/notices";
  };

  return (
    <div className="container-page space-y-6 py-10">
      <PageHeader
        eyebrow="Public record"
        title="Notices"
        description="Everything the branch office puts out in writing. Newest first."
      />

      <nav aria-label="Filter notices by type" className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/notices"
          className={`rounded-[4px] border px-3 py-1.5 ${
            active ? "border-line bg-paper text-green-900" : "border-green-700 bg-green-100 text-green-900"
          }`}
        >
          All
        </Link>
        {KINDS.map((item) => (
          <Link
            key={item}
            href={hrefFor(item, 1)}
            className={`rounded-[4px] border px-3 py-1.5 ${
              active === item
                ? "border-green-700 bg-green-100 text-green-900"
                : "border-line bg-paper text-green-900 hover:bg-green-100"
            }`}
          >
            {KIND_LABEL[item]}
          </Link>
        ))}
      </nav>

      {read.state === "ready" ? (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {read.items.map((notice) => (
              <li key={notice.slug}>
                <NoticeCard notice={notice} />
              </li>
            ))}
          </ul>
          <PageNav
            info={read.info}
            label="Notice pages"
            hrefFor={(page) => hrefFor(active, page)}
          />
        </>
      ) : read.state === "empty" ? (
        <EmptyState
          title="Nothing published under this filter yet"
          body="Try the All filter, or check back after the next branch meeting."
        />
      ) : (
        <SectionUnavailable what="Notices" />
      )}
    </div>
  );
}

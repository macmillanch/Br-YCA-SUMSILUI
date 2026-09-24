import type { Metadata } from "next";
import Link from "next/link";
import { NoticeCard } from "@/components/site/NoticeCard";
import { EmptyState, PageHeader } from "@/components/site/EmptyState";
import { getNotices, KIND_LABEL, type NoticeKind } from "@/lib/content";

export const metadata: Metadata = {
  title: "Notices",
  description:
    "Meeting notices, announcements and press releases issued by Young Chakma Association, Sumsilui Branch.",
};

const KINDS: readonly NoticeKind[] = ["notice", "announcement", "press_release"];

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const active = KINDS.includes(kind as NoticeKind) ? (kind as NoticeKind) : undefined;
  const notices = await getNotices(active);

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
            href={`/notices?kind=${item}`}
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

      {notices.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {notices.map((notice) => (
            <li key={notice.slug}>
              <NoticeCard notice={notice} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing published under this filter yet"
          body="Try the All filter, or check back after the next branch meeting."
        />
      )}
    </div>
  );
}

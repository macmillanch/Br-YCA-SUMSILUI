import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { getNoticeBySlug, getNotices, KIND_LABEL } from "@/lib/content";

export async function generateStaticParams() {
  const notices = await getNotices();
  return notices.map((notice) => ({ slug: notice.slug }));
}

/** An unknown slug must 404 at the routing layer, not after a 200 has streamed. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const notice = await getNoticeBySlug(slug);
  if (!notice) return { title: "Notice not found" };
  return {
    title: notice.title,
    description: notice.excerpt,
    openGraph: { type: "article", title: notice.title, description: notice.excerpt },
  };
}

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Renders the safe paragraph subset. Body text arrives as plain strings and is
 * emitted through React, so nothing from the database is ever read as HTML.
 */
function NoticeBody({ body }: { body: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-7">
      {body
        .split(/\n{2,}/)
        .filter((block) => block.trim().length > 0)
        .map((block, index) => (
          <p key={index}>{block}</p>
        ))}
    </div>
  );
}

export default async function NoticeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const notice = await getNoticeBySlug(slug);
  if (!notice) notFound();

  return (
    <article className="container-page max-w-3xl py-10">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{KIND_LABEL[notice.kind]}</Badge>
        <span className="text-sm text-ink-muted">Published {longDate(notice.publishedOn)}</span>
      </div>

      <h1 className="mt-4 text-3xl leading-tight sm:text-[38px]">{notice.title}</h1>

      {notice.eventDate || notice.venue ? (
        <dl className="mt-6 grid gap-4 rounded-[12px] border border-line bg-paper-alt p-5 text-sm sm:grid-cols-2">
          {notice.eventDate ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Date of the event
              </dt>
              <dd className="mt-1 font-medium">{longDate(notice.eventDate)}</dd>
            </div>
          ) : null}
          {notice.venue ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Venue</dt>
              <dd className="mt-1 font-medium">{notice.venue}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-8">
        <NoticeBody body={notice.body} />
      </div>

      <p className="mt-10 border-t border-line pt-6 text-xs text-ink-muted">
        Attachments and the Bengali and Chakma text of this notice appear here once the branch office
        publishes them.
      </p>
    </article>
  );
}

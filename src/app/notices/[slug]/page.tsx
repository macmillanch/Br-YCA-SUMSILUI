import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { NoticeLanguages } from "@/components/site/NoticeLanguages";
import { SectionUnavailable } from "@/components/site/EmptyState";
import { longDate } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";
import { getNoticeBySlug, getNotices } from "@/lib/content";

/**
 * Only the addresses that exist at build time are pre-rendered. `dynamicParams`
 * stays on — a notice published next month has no static page yet, and turning
 * it off would 404 every notice written after the last deploy.
 */
export async function generateStaticParams() {
  const notices = await getNotices();
  return notices.state === "ready" ? notices.items.map((notice) => ({ slug: notice.slug })) : [];
}

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getNoticeBySlug(slug);
  // A notice that could not be read is not a notice that does not exist, and the
  // tab is read before the page is: §9's rule holds there too.
  if (result.state === "missing") return { title: "Notice not found" };
  if (result.state !== "ready") return { title: "Notice temporarily unavailable" };
  const { notice } = result;
  return {
    title: notice.title,
    description: notice.excerpt,
    openGraph: { type: "article", title: notice.title, description: notice.excerpt },
  };
}

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getNoticeBySlug(slug);

  if (result.state === "missing") notFound();
  if (result.state === "unavailable") {
    return (
      <div className="container-page max-w-3xl py-10">
        <h1 className="text-3xl leading-tight">This notice</h1>
        <div className="mt-6">
          <SectionUnavailable what="This notice" />
        </div>
      </div>
    );
  }

  const { notice } = result;

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
        <NoticeLanguages bodyEn={notice.body} translations={notice.translations} />
      </div>

      {notice.attachments.length > 0 ? (
        <section className="mt-10 border-t border-line pt-6" aria-label="Attachments">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Attached files
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {notice.attachments.map((file) => (
              <li key={file.url}>
                <a
                  href={file.url}
                  className="text-green-700 underline underline-offset-2 hover:text-green-500"
                >
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notice.attachments.length === 0 && notice.translations.length === 0 ? (
        <p className="mt-10 border-t border-line pt-6 text-xs text-ink-muted">
          Anything attached to this notice, and its Bengali or Chakma text, appears here once the
          branch office publishes them.
        </p>
      ) : null}
    </article>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { SectionUnavailable } from "@/components/site/EmptyState";
import { longDate } from "@/lib/dates";
import { getWorkBySlug, getWorks, STATUS_LABEL } from "@/lib/content";
import { formatPaise } from "@/lib/money";

/**
 * Only the addresses that exist at build time are pre-rendered. `dynamicParams`
 * stays on — a work recorded next month has no static page yet, and turning it
 * off would 404 every work added after the last deploy.
 */
export async function generateStaticParams() {
  const works = await getWorks();
  return works.state === "ready" ? works.items.map((project) => ({ slug: project.slug })) : [];
}

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getWorkBySlug(slug);
  if (result.state !== "ready") return { title: "Work not found" };
  return { title: result.project.title, description: result.project.description };
}

export default async function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getWorkBySlug(slug);

  if (result.state === "missing") notFound();
  if (result.state === "unavailable") {
    return (
      <div className="container-page max-w-3xl py-10">
        <h1 className="text-3xl leading-tight">This work</h1>
        <div className="mt-6">
          <SectionUnavailable what="This work" />
        </div>
      </div>
    );
  }

  const { project, updates } = result;

  return (
    <article className="container-page max-w-3xl py-10">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={project.status === "deferred" ? "red" : "green"}>
          {STATUS_LABEL[project.status]}
        </Badge>
        {project.location ? <span className="text-sm text-ink-muted">{project.location}</span> : null}
      </div>

      <h1 className="mt-4 text-3xl leading-tight sm:text-[38px]">{project.title}</h1>
      <p className="mt-4 text-[15px] leading-7">{project.description}</p>

      {project.startDate || project.targetDate || project.completedDate ? (
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
          {project.startDate ? <li>Started {longDate(project.startDate)}</li> : null}
          {project.targetDate ? <li>Target {longDate(project.targetDate)}</li> : null}
          {project.completedDate ? <li>Completed {longDate(project.completedDate)}</li> : null}
          {project.beneficiaries > 0 ? (
            <li>{project.beneficiaries} beneficiaries</li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-8">
        {project.percentComplete === null ? (
          <p className="rounded-[12px] border border-dashed border-line bg-paper-alt p-5 text-sm text-ink-muted">
            No progress report has been published yet. The office-bearers add a dated report when the
            work is visited.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-muted">
                Reported by the branch
                {project.reportedOn ? ` on ${longDate(project.reportedOn)}` : ""}
              </span>
              <span className="font-semibold text-green-900 tabular-nums">
                {project.percentComplete}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={project.percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${project.title} progress`}
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-green-100"
            >
              <div
                className="h-full rounded-full bg-green-700"
                style={{ width: `${project.percentComplete}%` }}
              />
            </div>
          </>
        )}
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <caption className="sr-only">Money involved in this work</caption>
        <tbody>
          <tr className="border-b border-line">
            <th scope="row" className="py-3 pr-4 text-left font-normal text-ink-muted">
              Sanctioned amount
            </th>
            <td className="py-3 text-right font-medium tabular-nums">
              {project.sanctionedPaise > 0 ? formatPaise(project.sanctionedPaise) : "Not published"}
            </td>
          </tr>
          <tr className="border-b border-line">
            <th scope="row" className="py-3 pr-4 text-left font-normal text-ink-muted">
              Spent to date
            </th>
            <td className="py-3 text-right text-xs text-ink-muted">
              Published with the accounts
            </td>
          </tr>
        </tbody>
      </table>

      <section className="mt-10" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="text-xl">
          Progress reports
        </h2>

        {updates.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Nothing has been reported from the site yet.
          </p>
        ) : (
          <ol
            aria-label="Progress reports for this work, newest first"
            className="mt-5 space-y-6 border-l border-line pl-5"
          >
            {updates.map((update, index) => (
              <li key={`${update.date}-${index}`} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-green-700 ring-4 ring-paper"
                />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  {longDate(update.date)} · {update.percentComplete}%
                </p>
                <p className="mt-2 text-[15px] leading-7">{update.text}</p>
                {update.photos.length > 0 ? (
                  <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {update.photos.map((photo) => (
                      <li key={photo}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo}
                          alt={`Part of the work as it stood on ${longDate(update.date)}`}
                          className="h-28 w-full rounded-[8px] object-cover"
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

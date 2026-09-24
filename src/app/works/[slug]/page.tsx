import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import {
  getProjectBySlug,
  getProjects,
  progressPercentOf,
  STATUS_LABEL,
} from "@/lib/content";
import { formatPaise } from "@/lib/money";

export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((project) => ({ slug: project.slug }));
}

/** An unknown slug must 404 at the routing layer, not after a 200 has streamed. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return { title: "Work not found" };
  return { title: project.title, description: project.description };
}

export default async function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const percent = progressPercentOf(project);
  const remaining = project.sanctionedPaise - project.spentPaise;

  return (
    <article className="container-page max-w-3xl py-10">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={project.status === "deferred" ? "red" : "green"}>
          {STATUS_LABEL[project.status]}
        </Badge>
        <span className="text-sm text-ink-muted">{project.location}</span>
      </div>

      <h1 className="mt-4 text-3xl leading-tight sm:text-[38px]">{project.title}</h1>
      <p className="mt-4 text-[15px] leading-7">{project.description}</p>

      <div className="mt-8">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-ink-muted">Progress from the ledger</span>
          <span className="font-semibold text-green-900 tabular-nums">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-green-100"
        >
          <div className="h-full rounded-full bg-green-700" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <caption className="sr-only">Money involved in this work</caption>
        <tbody>
          {[
            { label: "Sanctioned amount", value: project.sanctionedPaise },
            { label: "Spent to date", value: project.spentPaise },
            { label: remaining >= 0 ? "Still to spend" : "Over sanction by", value: Math.abs(remaining) },
          ].map((row) => (
            <tr key={row.label} className="border-b border-line">
              <th scope="row" className="py-3 pr-4 text-left font-normal text-ink-muted">
                {row.label}
              </th>
              <td
                className={`py-3 text-right font-medium tabular-nums ${
                  row.value < 0 ? "text-red-700" : ""
                }`}
              >
                {formatPaise(row.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-10 border-t border-line pt-6 text-xs text-ink-muted">
        Date-wise updates from the field, photographs of the work, and the number of families helped are
        added to this page as the branch records them.
      </p>
    </article>
  );
}

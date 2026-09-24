import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { progressPercentOf, STATUS_LABEL, type PublicProject } from "@/lib/content";
import { formatPaise } from "@/lib/money";

const STATUS_TONE: Record<PublicProject["status"], "green" | "red" | "muted"> = {
  ongoing: "green",
  completed: "green",
  proposed: "muted",
  deferred: "red",
};

export function ProjectCard({ project }: { project: PublicProject }) {
  const percent = progressPercentOf(project);

  return (
    <Card as="article" className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
        <span className="text-xs text-ink-muted">{project.location}</span>
      </div>

      <h3 className="mt-3 text-lg leading-snug">
        <Link href={`/works/${project.slug}`} className="hover:text-green-700">
          {project.title}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-ink-muted">{project.description}</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-xs text-ink-muted">
          <span>Progress</span>
          <span className="font-semibold text-green-900">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${project.title} progress`}
          className="mt-1 h-2 overflow-hidden rounded-full bg-green-100"
        >
          <div className="h-full rounded-full bg-green-700" style={{ width: `${percent}%` }} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
          <dt className="text-ink-muted">Sanctioned</dt>
          <dd className="text-right font-medium tabular-nums">{formatPaise(project.sanctionedPaise)}</dd>
          <dt className="text-ink-muted">Spent so far</dt>
          <dd className="text-right font-medium tabular-nums">{formatPaise(project.spentPaise)}</dd>
        </dl>
      </div>
    </Card>
  );
}

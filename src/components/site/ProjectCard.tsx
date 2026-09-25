import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { shortDate } from "@/lib/dates";
import { STATUS_LABEL, type PublicProject } from "@/lib/content";
import { formatPaise } from "@/lib/money";
import { isOverspent, spendLine } from "@/lib/project-spend";

const STATUS_TONE: Record<PublicProject["status"], "green" | "red" | "muted"> = {
  ongoing: "green",
  completed: "green",
  proposed: "muted",
  deferred: "red",
};

/**
 * A work that has cost more than the branch sanctioned for it is the one figure
 * in the row a reader needs to notice, so it is printed in red rather than in
 * the same ink as the rest. An unreadable ledger is not alarming, only quiet.
 */
function spendTone(project: PublicProject): string {
  if (project.spentPaise === null) return "text-right text-xs text-ink-muted";
  if (isOverspent(project.budgetSharePct)) {
    return "text-right font-medium tabular-nums text-red-700";
  }
  return "text-right font-medium tabular-nums";
}

/**
 * One work on the list. The bar shows the percentage the branch reported on its
 * latest dated line and nothing else — a half-paid contractor has not
 * necessarily built half a tank. The money beside it is a different kind of
 * figure: it is summed from the vouchers naming this work, so it is a number a
 * treasurer entered, and it says so in the same words every other screen uses.
 */
export function ProjectCard({ project }: { project: PublicProject }) {
  return (
    <Card as="article" className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
        {project.location ? (
          <span className="text-xs text-ink-muted">{project.location}</span>
        ) : null}
      </div>

      <h3 className="mt-3 text-lg leading-snug">
        <Link href={`/works/${project.slug}`} className="hover:text-green-700">
          {project.title}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-ink-muted">{project.description}</p>

      <div className="mt-5">
        {project.percentComplete === null ? (
          <p className="text-sm text-ink-muted">
            No progress report yet
            {project.beneficiaries > 0 ? ` · ${project.beneficiaries} beneficiaries` : ""}
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between text-xs text-ink-muted">
              <span>
                Progress
                {project.reportedOn ? (
                  <span className="ml-1">reported {shortDate(project.reportedOn)}</span>
                ) : null}
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
              className="mt-1 h-2 overflow-hidden rounded-full bg-green-100"
            >
              <div
                className="h-full rounded-full bg-green-700"
                style={{ width: `${project.percentComplete}%` }}
              />
            </div>
          </>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
          <dt className="text-ink-muted">Sanctioned</dt>
          <dd className="text-right font-medium tabular-nums">
            {project.sanctionedPaise > 0 ? formatPaise(project.sanctionedPaise) : "Not published"}
          </dd>
          <dt className="text-ink-muted">Spent</dt>
          <dd className={spendTone(project)}>
            {spendLine(project.spentPaise, project.sanctionedPaise)}
          </dd>
        </dl>
      </div>
    </Card>
  );
}

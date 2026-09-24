import type { Metadata } from "next";
import { ProjectCard } from "@/components/site/ProjectCard";
import { PageHeader } from "@/components/site/EmptyState";
import { getProjects, STATUS_LABEL, type ProjectStatus } from "@/lib/content";

export const metadata: Metadata = {
  title: "Works",
  description:
    "The projects Young Chakma Association, Sumsilui Branch has taken on — ongoing, proposed, completed and deferred — with what has been spent on each.",
};

const GROUPS: readonly ProjectStatus[] = ["ongoing", "proposed", "completed", "deferred"];

export default async function WorksPage() {
  const projects = await getProjects();

  return (
    <div className="container-page space-y-10 py-10">
      <PageHeader
        eyebrow="Work progress"
        title="Works and projects"
        description="Each work shows what was sanctioned and what has actually been spent. The spent figure is summed from the accounts, so a progress bar cannot say more than the ledger supports."
      />

      {GROUPS.map((status) => {
        const group = projects.filter((project) => project.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} aria-labelledby={`works-${status}`}>
            <h2 id={`works-${status}`} className="text-xl">
              {STATUS_LABEL[status]}
              <span className="ml-2 text-sm font-normal text-ink-muted">
                ({group.length} {group.length === 1 ? "work" : "works"})
              </span>
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((project) => (
                <li key={project.slug}>
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

import type { Metadata } from "next";
import { ProjectCard } from "@/components/site/ProjectCard";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { getWorks, STATUS_LABEL, type ProjectStatus } from "@/lib/content";

export const metadata: Metadata = {
  title: "Works",
  description:
    "The projects Young Chakma Association, Sumsilui Branch has taken on — ongoing, proposed, completed and deferred — with the progress the branch has reported on each.",
};

export const revalidate = 300;

const GROUPS: readonly ProjectStatus[] = ["ongoing", "proposed", "completed", "deferred"];

export default async function WorksPage() {
  const works = await getWorks();

  return (
    <div className="container-page space-y-10 py-10">
      <PageHeader
        eyebrow="Work progress"
        title="Works and projects"
        description="Each work shows what was sanctioned for it and the percentage the branch reported on its latest dated visit to the site. What has been spent comes from the accounts, and appears with them."
      />

      {works.state === "unavailable" ? <SectionUnavailable what="Works" /> : null}

      {works.state === "empty" ? (
        <EmptyState
          title="No works recorded yet"
          body="The branch has not entered any work on this site yet. Office-bearers add a work, and its progress reports, from the admin area."
        />
      ) : null}

      {works.state === "ready"
        ? GROUPS.map((status) => {
            const group = works.items.filter((project) => project.status === status);
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
          })
        : null}
    </div>
  );
}

import { ContactSection } from "@/components/site/ContactSection";
import { FinanceSummary } from "@/components/site/FinanceSummary";
import { GalleryStrip } from "@/components/site/GalleryStrip";
import { Hero } from "@/components/site/Hero";
import { NoticeCard } from "@/components/site/NoticeCard";
import { SectionUnavailable } from "@/components/site/EmptyState";
import { ProjectCard } from "@/components/site/ProjectCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getHomepageContent } from "@/lib/content";

export const revalidate = 300;

export default async function HomePage() {
  const content = await getHomepageContent();

  return (
    <>
      <Hero introduction={content.introduction} />

      <div className="container-page space-y-16 py-12 md:py-16">
        <section aria-labelledby="notices-heading">
          <SectionHeading
            id="notices-heading"
            eyebrow="What is happening"
            title="Latest notices"
            description="Meeting notices, announcements and press releases issued by the branch."
            action={{ href: "/notices", label: "View all notices" }}
          />
          {content.notices.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {content.notices.map((notice) => (
                <li key={notice.slug}>
                  <NoticeCard notice={notice} />
                </li>
              ))}
            </ul>
          ) : content.noticesUnavailable ? (
            <div className="mt-6">
              <SectionUnavailable what="Notices" />
            </div>
          ) : (
            <p className="mt-6 rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
              No notices have been published yet.
            </p>
          )}
        </section>

        <section aria-labelledby="works-heading">
          <SectionHeading
            id="works-heading"
            eyebrow="What has been done"
            title="Ongoing works"
            description="Each work shows what was sanctioned for it and the progress the branch last reported from the site."
            action={{ href: "/works", label: "View all works" }}
          />
          {content.projects.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {content.projects.map((project) => (
                <li key={project.slug}>
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
          ) : content.projectsUnavailable ? (
            <div className="mt-6">
              <SectionUnavailable what="Works" />
            </div>
          ) : (
            <p className="mt-6 rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
              No work is under way on this site yet.
            </p>
          )}
        </section>

        <section aria-labelledby="finance-heading" className="rounded-[12px] bg-paper-alt p-6 md:p-8">
          <SectionHeading
            id="finance-heading"
            eyebrow="Where the money went"
            title="Financial transparency"
            description="The current year at a glance, as the treasurer publishes it."
          />
          <div className="mt-6">
            <FinanceSummary finance={content.finance} />
          </div>
        </section>

        <section aria-labelledby="gallery-heading">
          <SectionHeading
            id="gallery-heading"
            eyebrow="In pictures"
            title="From the branch"
            action={{ href: "/gallery", label: "View gallery" }}
          />
          <div className="mt-6">
            <GalleryStrip photos={content.photos} unavailable={content.photosUnavailable} />
          </div>
        </section>

        <section aria-labelledby="contact-heading">
          <SectionHeading id="contact-heading" title="Contact the branch" />
          <div className="mt-6">
            <ContactSection contact={content.contact} />
          </div>
        </section>
      </div>
    </>
  );
}

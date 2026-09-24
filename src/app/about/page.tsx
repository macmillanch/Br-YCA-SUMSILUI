import type { Metadata } from "next";
import { PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { getAboutContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description:
    "Young Chakma Association was established in 1978. This page describes the association and its Sumsilui Branch.",
};

/**
 * What the branch has not written yet, said plainly. The alternative — a
 * paragraph composed by whoever built the site — reads to a visitor as the
 * branch's own statement of purpose, and no marker on the page can take that
 * back.
 */
function NotWrittenYet({ children }: { children: string }) {
  return (
    <p className="mt-3 rounded-[12px] border border-dashed border-line bg-paper-alt p-5 text-sm leading-6 text-ink-muted">
      {children}
    </p>
  );
}

export default async function AboutPage() {
  const about = await getAboutContent();

  return (
    <div className="container-page max-w-3xl space-y-10 py-10">
      <PageHeader
        eyebrow="Who we are"
        title="About the association"
        description="Young Chakma Association is a community association of the Chakma people of Mizoram. It is run by its members through an elected body of office-bearers."
      />

      <section aria-labelledby="about-history">
        <h2 id="about-history">History</h2>
        <p className="mt-3 text-[15px] leading-7">
          Young Chakma Association was established in 1978. Since then it has worked through branch
          units, each run by its own office-bearers, on the association&rsquo;s standing appeal to
          its members: <em>Do Help</em>.
        </p>
        {about.foundedYear ? (
          <p className="mt-3 text-[15px] leading-7">
            The Sumsilui Branch was founded in {about.foundedYear}.
          </p>
        ) : null}
        {about.registrationNo ? (
          <p className="mt-3 text-[15px] leading-7">Registered as {about.registrationNo}.</p>
        ) : null}
      </section>

      <section aria-labelledby="about-branch">
        <h2 id="about-branch">Sumsilui Branch</h2>
        {about.unavailable ? (
          <div className="mt-3">
            <SectionUnavailable what="The branch's own words" />
          </div>
        ) : about.branchStory ? (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-7">{about.branchStory}</p>
        ) : (
          <NotWrittenYet>
            The office-bearers have not written the branch&rsquo;s own account of how it began and
            what it does locally. It will appear here word for word from Admin&nbsp;&rarr;&nbsp;Settings.
          </NotWrittenYet>
        )}
      </section>

      <section aria-labelledby="about-mission">
        <h2 id="about-mission">Mission and objectives</h2>
        {about.unavailable ? (
          <div className="mt-3">
            <SectionUnavailable what="The branch's objectives" />
          </div>
        ) : about.mission ? (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-7">{about.mission}</p>
        ) : (
          <NotWrittenYet>
            The branch has not entered its mission and objectives yet. They will appear here as the
            office-bearers write them.
          </NotWrittenYet>
        )}
      </section>
    </div>
  );
}

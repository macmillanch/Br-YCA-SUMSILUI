import type { Metadata } from "next";
import { PageHeader } from "@/components/site/EmptyState";

export const metadata: Metadata = {
  title: "About",
  description:
    "Young Chakma Association was established in 1978. This page describes the association and its Sumsilui Branch.",
};

const OBJECTIVES = [
  "To keep the younger members of the community in touch with one another, and to give them a place to meet and work together.",
  "To help students with their studies, and to arrange assistance where a family cannot meet the cost of schooling alone.",
  "To carry out work the locality needs — water, light, drains, paths and places to meet — and to account publicly for what is spent.",
  "To look after the culture and language of the community, and to pass them on to those growing up now.",
  "To be of help in times of need, whether to members of the branch or to neighbours of the locality.",
];

export default function AboutPage() {
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
      </section>

      <section aria-labelledby="about-branch">
        <h2 id="about-branch">Sumsilui Branch</h2>
        <p className="mt-3 text-[15px] leading-7 text-ink-muted">
          The branch was founded in a year the office-bearers have not yet entered in the site
          settings, and its current office-bearers are listed on the executive members page. When the
          branch supplies its own account of how it began, that text replaces this note from
          Admin&nbsp;&rarr;&nbsp;Settings rather than being written into the site by a developer.
        </p>
      </section>

      <section aria-labelledby="about-mission">
        <h2 id="about-mission">Mission</h2>
        <p className="mt-3 text-[15px] leading-7">
          To serve the people of Sumsilui by doing openly what a community association can do well:
          bringing people together, helping students, completing small works the locality needs, and
          keeping an account of every rupee that passes through the association&rsquo;s hands.
        </p>
      </section>

      <section aria-labelledby="about-objectives">
        <h2 id="about-objectives">Objectives</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-7 marker:text-green-700 marker:font-semibold">
          {OBJECTIVES.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

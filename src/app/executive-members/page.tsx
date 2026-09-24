import type { Metadata } from "next";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { MemberCard } from "@/components/site/MemberCard";
import { getCommittee } from "@/lib/content";

export const metadata: Metadata = {
  title: "Executive members",
  description:
    "The office-bearers of Young Chakma Association, Sumsilui Branch, and those who held these offices before them.",
};

export const revalidate = 300;

export default async function ExecutiveMembersPage() {
  const committee = await getCommittee();

  return (
    <div className="container-page space-y-10 py-10">
      <PageHeader
        eyebrow="Who runs this branch"
        title="Executive members"
        description="The office-bearers in post for the current term, listed in the order the branch sets. Where an office-bearer has agreed to be contacted, a phone number and an email address appear on their card."
      />

      {committee.state === "unavailable" ? <SectionUnavailable what="The office-bearer list" /> : null}

      {committee.state === "empty" ? (
        <EmptyState
          title="The office-bearer list has not been published yet"
          body="Names, positions, terms of office and photographs are entered by the branch Secretary in Admin → Members. Each person is shown here as President, General Secretary, Treasurer and so on, in the order the branch sets, and nothing is displayed until the branch itself publishes it."
          action={{ href: "/admin", label: "Office-bearers: sign in to add the list" }}
        />
      ) : null}

      {committee.state === "ready"
        ? committee.sections.map((section) => (
            <section key={section.type} aria-labelledby={`committee-${section.type}`}>
              <h2 id={`committee-${section.type}`} className="text-xl">
                {section.label}
              </h2>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.members.map((member) => (
                  <MemberCard key={member.name} member={member} />
                ))}
              </ul>
            </section>
          ))
        : null}

      {committee.state === "ready" && committee.past.length > 0 ? (
        <section aria-labelledby="past-officers" className="border-t border-line pt-8">
          <h2 id="past-officers" className="text-xl">
            Past office-bearers
          </h2>
          <p className="mt-2 max-w-prose text-[15px] leading-7 text-ink-muted">
            Those who held these offices in an earlier term. The branch keeps the record so that
            members can see the succession of hands it has passed through.
          </p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {committee.past.map((member) => (
              <MemberCard key={member.name} member={member} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

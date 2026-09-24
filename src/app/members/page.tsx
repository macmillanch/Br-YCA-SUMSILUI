import type { Metadata } from "next";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { getMemberDirectory } from "@/lib/content";

export const metadata: Metadata = {
  title: "Members",
  description: "The registered members of Young Chakma Association, Sumsilui Branch.",
};

export const revalidate = 300;

export default async function MembersPage() {
  const directory = await getMemberDirectory();

  return (
    <div className="container-page space-y-8 py-10">
      <PageHeader
        eyebrow="Community members"
        title="Member directory"
        description="The register of members held by the branch office. The public list shows a name, the ward or locality, and any position held. Phone numbers, addresses and family details stay in the office record and are not published."
      />

      {directory.state === "unavailable" ? <SectionUnavailable what="The member register" /> : null}

      {directory.state === "empty" ? (
        <EmptyState
          title="The member register has not been published yet"
          body="The branch keeps its register of members in the admin area, under Admin → Members. A name entered there as a community member appears here — name, ward and any position held, and nothing else."
          action={{ href: "/admin", label: "Office-bearers: sign in to manage the register" }}
        />
      ) : null}

      {directory.state === "ready" ? (
        <>
          <p className="text-sm text-ink-muted">
            {directory.items.length} {directory.items.length === 1 ? "member is" : "members are"}{" "}
            listed. The list follows the order the branch keeps it in.
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-paper">
            {directory.items.map((member) => (
              <li key={member.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                <span className="font-medium text-green-900">{member.name}</span>
                {member.ward ? <span className="text-sm text-ink-muted">{member.ward}</span> : null}
                {member.position ? (
                  <span className="text-sm text-ink">{member.position}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

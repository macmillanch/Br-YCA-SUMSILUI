import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/site/EmptyState";

export const metadata: Metadata = {
  title: "Executive members",
  description:
    "The office-bearers of Young Chakma Association, Sumsilui Branch, and those who held these offices before them.",
};

export default function ExecutiveMembersPage() {
  return (
    <div className="container-page space-y-8 py-10">
      <PageHeader
        eyebrow="Who runs this branch"
        title="Executive members"
        description="The office-bearers in post for the current term, listed in order of precedence. Where an office-bearer has agreed to be contacted, a phone number and email address appear on their card."
      />

      <EmptyState
        title="The office-bearer list has not been published yet"
        body="Names, positions, terms of office and photographs are entered by the branch Secretary in Admin → Members. Each person is shown here as President, General Secretary, Treasurer and so on, in the order the branch sets, and nothing is displayed until the branch itself publishes it."
        action={{ href: "/admin", label: "Office-bearers: sign in to add the list" }}
      />

      <section aria-labelledby="past-officers">
        <h2 id="past-officers" className="text-xl">
          Past office-bearers
        </h2>
        <p className="mt-3 max-w-prose text-[15px] leading-7 text-ink-muted">
          The association keeps a record of those who held office in the branch before the present
          term. That list will appear beneath this note once it has been entered, so that members can
          see the succession of hands the branch has passed through.
        </p>
      </section>
    </div>
  );
}

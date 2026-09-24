import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/site/EmptyState";

export const metadata: Metadata = {
  title: "Members",
  description: "The registered members of Young Chakma Association, Sumsilui Branch.",
};

export default function MembersPage() {
  return (
    <div className="container-page space-y-8 py-10">
      <PageHeader
        eyebrow="Community members"
        title="Member directory"
        description="The register of members held by the branch office. The public list shows a name, the ward or locality, and any position held. Phone numbers, addresses and family details stay in the office record and are not published."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <label htmlFor="member-search" className="block text-sm font-medium">
            Search members
          </label>
          <input
            id="member-search"
            type="search"
            name="q"
            placeholder="Name"
            className="mt-2 min-h-11 w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm"
            disabled
            aria-describedby="member-search-help"
          />
          <p id="member-search-help" className="mt-1 text-xs text-ink-muted">
            Searching is enabled once the register has been published.
          </p>
        </div>
      </div>

      <EmptyState
        title="The member register has not been published yet"
        body="The branch maintains its register of members in the admin area. When a page of the register is published, names appear here in a searchable, paginated list — name, ward, and position only."
        action={{ href: "/admin", label: "Office-bearers: sign in to manage the register" }}
      />
    </div>
  );
}

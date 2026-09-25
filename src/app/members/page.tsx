import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { PageNav } from "@/components/site/PageNav";
import { getMemberDirectoryPage } from "@/lib/content";
import { parseNameSearch } from "@/lib/member-search";
import { parsePageParam } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Members",
  description:
    "Search the register of community members of Young Chakma Association, Sumsilui Branch by name.",
};

export const revalidate = 300;

/** A register read on a phone: enough names to scan, not the whole list at once. */
const PER_PAGE = 20;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const search = parseNameSearch(params);
  const page = parsePageParam(params);
  const directory = await getMemberDirectoryPage(search, page, PER_PAGE);
  const looking = search.term !== "";

  // A new search is a new question, so it starts from the top of the answer.
  const hrefFor = (number: number) => {
    const query = new URLSearchParams();
    if (search.term !== "") query.set("q", search.term);
    if (number > 1) query.set("page", String(number));
    const text = query.toString();
    return text ? `/members?${text}` : "/members";
  };

  return (
    <div className="container-page space-y-8 py-10">
      <PageHeader
        eyebrow="Community members"
        title="Member directory"
        description="The register of members held by the branch office. The public list shows a name, the ward or locality, and any position held. Phone numbers, addresses and family details stay in the office record and are not published."
      />

      {/* A GET form, so a search has an address of its own that can be shared and
          works with JavaScript switched off. */}
      <form method="get" action="/members" className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="member-q" className="block text-sm font-medium">
            Search by name
          </label>
          <input
            id="member-q"
            name="q"
            type="search"
            defaultValue={search.term}
            placeholder="Ashok Chakma"
            className="mt-2 min-h-11 w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm sm:w-72"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="min-h-11 rounded-[4px] bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
          >
            Search
          </button>
          {looking ? (
            <Link
              href="/members"
              className="min-h-11 rounded-[4px] border border-line px-4 py-2 text-sm text-green-900 hover:bg-green-100"
            >
              Show the whole register
            </Link>
          ) : null}
        </div>
      </form>

      {directory.state === "unavailable" ? (
        <SectionUnavailable what="The member register" many={false} />
      ) : null}

      {directory.state === "empty" ? (
        <EmptyState
          title={looking ? "No member in the register matches that name" : "The member register has not been published yet"}
          body={
            looking
              ? "Every word typed has to appear in the name, in any order. The public register lists community members only — office-bearers are on the Executive Members page."
              : "The branch keeps its register of members in the admin area, under Admin → Members. A name entered there as a community member appears here — name, ward and any position held, and nothing else."
          }
          action={
            looking
              ? { href: "/executive-members", label: "See the office-bearers instead" }
              : { href: "/admin", label: "Office-bearers: sign in to manage the register" }
          }
        />
      ) : null}

      {directory.state === "ready" ? (
        <>
          <p className="text-sm text-ink-muted">
            {looking ? (
              <>
                {directory.info.total}{" "}
                {directory.info.total === 1 ? "member matches" : "members match"}{" "}
                <span className="font-medium text-ink">“{search.term}”</span>.{" "}
              </>
            ) : (
              <>
                {directory.info.total}{" "}
                {directory.info.total === 1 ? "member is" : "members are"} listed.{" "}
              </>
            )}
            The list follows the order the branch keeps it in.
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-paper">
            {directory.items.map((member, index) => (
              <li
                key={`${index}-${member.name}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="font-medium text-green-900">{member.name}</span>
                {member.ward ? <span className="text-sm text-ink-muted">{member.ward}</span> : null}
                {member.position ? (
                  <span className="text-sm text-ink">{member.position}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <PageNav info={directory.info} label="Member directory pages" hrefFor={hrefFor} />
        </>
      ) : null}
    </div>
  );
}

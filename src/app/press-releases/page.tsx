import type { Metadata } from "next";
import { NoticeCard } from "@/components/site/NoticeCard";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { getNotices } from "@/lib/content";

export const metadata: Metadata = {
  title: "Press releases",
  description:
    "Statements issued by Young Chakma Association, Sumsilui Branch to the press and to the public.",
};

export default async function PressReleasesPage() {
  const read = await getNotices("press_release");

  return (
    <div className="container-page space-y-6 py-10">
      <PageHeader
        eyebrow="Public record"
        title="Press releases"
        description="Statements the branch has issued publicly. These are stored with the notices and filtered by type, so nothing is published twice."
      />

      {read.state === "ready" ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {read.items.map((notice) => (
            <li key={notice.slug}>
              <NoticeCard notice={notice} />
            </li>
          ))}
        </ul>
      ) : read.state === "empty" ? (
        <EmptyState
          title="No press releases yet"
          body="Statements issued to the press will be listed here."
          action={{ href: "/notices", label: "Browse all notices instead" }}
        />
      ) : (
        <SectionUnavailable what="Press releases" />
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { NoticeCard } from "@/components/site/NoticeCard";
import { EmptyState, PageHeader } from "@/components/site/EmptyState";
import { getNotices } from "@/lib/content";

export const metadata: Metadata = {
  title: "Press releases",
  description:
    "Statements issued by Young Chakma Association, Sumsilui Branch to the press and to the public.",
};

export default async function PressReleasesPage() {
  const releases = await getNotices("press_release");

  return (
    <div className="container-page space-y-6 py-10">
      <PageHeader
        eyebrow="Public record"
        title="Press releases"
        description="Statements the branch has issued publicly. These are stored with the notices and filtered by type, so nothing is published twice."
      />

      {releases.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {releases.map((notice) => (
            <li key={notice.slug}>
              <NoticeCard notice={notice} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No press releases yet"
          body="Statements issued to the press will be listed here."
          action={{ href: "/notices", label: "Browse all notices instead" }}
        />
      )}
    </div>
  );
}

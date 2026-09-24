import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/site/EmptyState";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photographs of branch events and works, published with written descriptions.",
};

export default async function GalleryPage() {
  return (
    <div className="container-page space-y-6 py-10">
      <PageHeader
        eyebrow="In pictures"
        title="Gallery"
        description="Photographs are grouped by album. Every picture carries a written description so that it reads properly for someone using a screen reader, and thumbnails are served at display size rather than as full-resolution originals."
      />

      <EmptyState
        title="No albums published yet"
        body="Photographs from meetings, camps and works will be added here from Admin → Gallery. Each upload requires a description before it can be saved."
        action={{ href: "/admin", label: "Office-bearers: sign in to upload" }}
      />
    </div>
  );
}

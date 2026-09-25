import type { Metadata } from "next";
import { ContactSection } from "@/components/site/ContactSection";
import { PageHeader } from "@/components/site/EmptyState";
import { getContactDetails } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to reach Young Chakma Association, Sumsilui Branch — office address, phone, email and office-bearer contacts.",
};

export default async function ContactPage() {
  const { contact, unavailable } = await getContactDetails();

  return (
    <div className="container-page space-y-8 py-10">
      <PageHeader
        eyebrow="Get in touch"
        title="Contact the branch"
        description="Write to the Secretary for anything the branch handles, and to the Treasurer for a receipt or a query about the accounts."
      />

      <ContactSection contact={contact} unavailable={unavailable} />

      <p className="text-xs leading-5 text-ink-muted">
        Contact details are held in one place — Admin&nbsp;&rarr;&nbsp;Settings — and read from there
        wherever they appear, so a change of office number takes effect across the whole site at once.
      </p>
    </div>
  );
}

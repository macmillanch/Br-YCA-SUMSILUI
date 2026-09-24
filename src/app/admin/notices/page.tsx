import type { Metadata } from "next";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { NoticesTable } from "@/components/admin/NoticesTable";
import { Button } from "@/components/ui/Button";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { listNotices, toAdminNotice } from "@/lib/notices";

export const metadata: Metadata = { title: "Notices", robots: { index: false } };

export default async function AdminNoticesPage() {
  const ctx = await readAdminContext();
  if (!ctx) return null;

  // Draft notices are not for a treasurer's eyes, and this page reads them
  // server-side, so the gate has to be here as well as in the API.
  if (!maySee(ctx, ["editor"])) {
    return (
      <NotPermitted
        title="Notices"
        body="Notices and press releases are written by an editor. Ask an editor to publish one, or a super-admin to change your role."
      />
    );
  }

  const notices = (await listNotices()).map(toAdminNotice);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Notices and press releases</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            A draft is visible only here. Publishing puts it on the public notices list, the homepage
            and its own web address at once.
          </p>
        </div>
        <Button href="/admin/notices/new">Write a notice</Button>
      </div>

      <NoticesTable notices={notices} />
    </div>
  );
}

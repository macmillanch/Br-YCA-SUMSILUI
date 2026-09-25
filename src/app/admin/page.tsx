import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { listGalleryDocs } from "@/lib/gallery";
import { listPublishedNotices } from "@/lib/notices";
import { publicProjects } from "@/lib/projects";
import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const store = await cookies();
  const ctx = await resolveSession(store.get(SESSION_COOKIE)?.value ?? "");
  if (!ctx) return null;

  const [users, settings, notices, works, pictures] = await Promise.all([
    listUsers(),
    getSettings(),
    listPublishedNotices(),
    publicProjects("ongoing"),
    listGalleryDocs(),
  ]);
  const missing = [
    settings.addressLine ? null : "address",
    settings.phone ? null : "phone",
    settings.email ? null : "email",
    settings.missionText ? null : "the branch's own account and mission",
    settings.accountNumber ? null : "bank account details",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <p className="text-3xl font-semibold text-green-700">{users.length}</p>
          <p className="text-sm text-ink-muted">Admin accounts</p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold text-green-700">{notices.length}</p>
          <p className="text-sm text-ink-muted">Notices published</p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold text-green-700">{works.length}</p>
          <p className="text-sm text-ink-muted">Works under way</p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold text-green-700">{pictures.length}</p>
          <p className="text-sm text-ink-muted">Pictures published</p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold text-green-700">{settings.branchName ? "Set" : "Empty"}</p>
          <p className="text-sm text-ink-muted">Branch name in Settings</p>
        </Card>
      </div>

      {missing.length > 0 ? (
        <Card className="border-red-700/30 bg-red-100">
          <h2 className="text-base text-red-700">Still to complete</h2>
          <p className="mt-1 text-sm">
            These details appear on the public site and are still blank: {missing.join(", ")}. Fill
            them in under Settings. Until you do, the site says “not published yet” rather than
            inventing anything.
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-base">What is ready now</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Notices, the committee and member register, works with their dated progress reports and
          the photograph gallery are live: what you save here appears on the public pages within
          five minutes. The year&rsquo;s accounts come with the finance screens. A picture uploaded
          as a file needs the branch&rsquo;s own image store keys in the server environment; until
          they are in place, an office-bearer can add a picture by its web address.
        </p>
      </Card>
    </div>
  );
}

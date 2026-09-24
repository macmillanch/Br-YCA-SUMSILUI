import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const store = await cookies();
  const ctx = await resolveSession(store.get(SESSION_COOKIE)?.value ?? "");
  if (!ctx) return null;

  const [users, settings] = await Promise.all([listUsers(), getSettings()]);
  const missing = [
    settings.addressLine ? null : "address",
    settings.phone ? null : "phone",
    settings.email ? null : "email",
    settings.accountNumber ? null : "bank account details",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-3xl font-semibold text-green-700">{users.length}</p>
          <p className="text-sm text-ink-muted">Admin accounts</p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold text-green-700">0</p>
          <p className="text-sm text-ink-muted">Notices published</p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold text-green-700">0</p>
          <p className="text-sm text-ink-muted">Ongoing works</p>
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
          Sign-in, site settings and user accounts. Notices, members, works and the gallery come in
          the next build phase; the ledger and published finances after that. The two counters
          above read zero because those sections are not connected yet, not because the branch has
          nothing to show.
        </p>
      </Card>
    </div>
  );
}

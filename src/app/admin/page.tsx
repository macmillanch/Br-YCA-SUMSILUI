import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { getFinanceSummary } from "@/lib/content";
import { MANAGE_FINANCE } from "@/lib/finance";
import { listGalleryDocs } from "@/lib/gallery";
import { formatPaise } from "@/lib/money";
import { canSee } from "@/lib/nav";
import { listPublishedNotices } from "@/lib/notices";
import { publicProjects } from "@/lib/projects";
import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const store = await cookies();
  const ctx = await resolveSession(store.get(SESSION_COOKIE)?.value ?? "");
  if (!ctx) return null;

  const [users, settings, notices, works, pictures, finance] = await Promise.all([
    listUsers(),
    getSettings(),
    listPublishedNotices(),
    publicProjects("ongoing"),
    listGalleryDocs(),
    getFinanceSummary(),
  ]);
  // Whether this account keeps the book, which decides whether the dashboard's
  // figures are something they can change or only something they can read.
  const keepsBook = canSee(ctx.user.role, MANAGE_FINANCE);
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

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base">
            {finance.snapshot ? `${finance.snapshot.yearLabel}, as the book stands` : "The accounts"}
          </h2>
          <Link
            href={keepsBook ? "/admin/finance" : "/finance"}
            className="text-sm text-green-700 underline underline-offset-2"
          >
            {keepsBook ? "Enter a voucher" : "What the public reads"}
          </Link>
        </div>

        {finance.unavailable ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            The figures could not be read just now, so none are shown rather than a part of them.
            Nothing has changed. Try again in a moment; if it continues, the database needs looking
            at.
          </p>
        ) : finance.snapshot ? (
          <>
            <dl className="mt-3 grid gap-4 sm:grid-cols-3">
              {[
                { term: "Money received", figure: finance.snapshot.incomePaise, tone: "text-green-900" },
                { term: "Paid out", figure: finance.snapshot.expensePaise, tone: "text-red-700" },
                { term: "Balance", figure: finance.snapshot.closingPaise, tone: "text-ink" },
              ].map((entry) => (
                <div key={entry.term}>
                  <dt className="text-sm text-ink-muted">{entry.term}</dt>
                  <dd className={`mt-1 text-2xl font-semibold tabular-nums ${entry.tone}`}>
                    {formatPaise(entry.figure)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-ink-muted">
              Totalled from the vouchers entered against {finance.snapshot.yearLabel}, counting from
              an opening balance of {formatPaise(finance.snapshot.openingPaise)} — the same figures
              the public page prints, from the same lines.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            No financial year has been opened yet, so there is nothing to total. A year has to be
            opened before a voucher can be entered against it.
          </p>
        )}
      </Card>

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
          Notices, the committee and member register, works with their dated progress reports, the
          photograph gallery and the year&rsquo;s accounts are live: what is saved here appears on
          the public pages within five minutes. A picture uploaded as a file needs the
          branch&rsquo;s own image store keys in the server environment; until they are in place, an
          office-bearer can add a picture by its web address.
        </p>
      </Card>
    </div>
  );
}

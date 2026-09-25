import type { Metadata } from "next";
import Link from "next/link";
import { DonationForm } from "@/components/admin/DonationForm";
import { DonationsTable } from "@/components/admin/DonationsTable";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { MANAGE_FINANCE, yearLabelsByLock } from "@/lib/finance";
import { adminDonationsPage } from "@/lib/donations";
import { formatPaise, sumPaise } from "@/lib/money";

export const metadata: Metadata = { title: "Contributions", robots: { index: false } };

/** Join a handful of year labels the way a sentence reads. */
function listOf(names: readonly string[]): string {
  if (names.length === 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

/**
 * The contributions, and the one screen from which they change.
 *
 * A contribution is not a second book beside the ledger: recording one enters an
 * income voucher in the year it falls under, and the donation names that voucher.
 * That is why the figure and the thank-you can never disagree — and why a closed
 * year refuses an entry here exactly as it refuses one on the ledger screen. Which
 * years are closed is said above the form rather than after the work is typed,
 * because a date is the treasurer's to choose and the years they may choose from
 * belong to the accounts, not to this screen's guess.
 *
 * The total on this screen is described as the sum of the entries listed, not as
 * the year's income. Contributions are held for every year in one list, and a
 * figure that looks like a year's total but counts the wrong years is worse than
 * no figure.
 */
export default async function AdminDonationsPage() {
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_FINANCE)) {
    return (
      <NotPermitted
        title="Contributions"
        body="A contribution is money received, so it is entered by the Treasurer and appears in the published accounts. An editor can read the accounts but not change them."
      />
    );
  }

  const [page, years] = await Promise.all([adminDonationsPage(), yearLabelsByLock()]);

  if (page.state === "unavailable") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl">Contributions</h1>
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          The contributions could not be read just now, so none are shown rather than a part of
          them. Nothing has changed. Try again in a moment; if it continues, the database needs
          looking at.
        </p>
      </div>
    );
  }

  const totalPaise = sumPaise(page.items.map((donation) => donation.amountPaise));
  const lockMessage =
    years.open.length > 0
      ? null
      : years.closed.length > 0
        ? `Every year kept here stands closed (${listOf(years.closed)}). A contribution needs a year that takes vouchers — either the new one, or one a super-admin reopens with a reason.`
        : "No financial year has been opened yet, so a contribution has no year to be entered against. Open one on the accounts screen first.";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">
            <Link href="/admin/finance" className="text-green-700 underline underline-offset-2">
              The accounts
            </Link>
          </p>
          <h1 className="mt-1 text-2xl">Contributions</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            {page.items.length === 0
              ? "Nothing has been recorded here yet."
              : `${page.items.length} contribution${
                  page.items.length === 1 ? "" : "s"
                } recorded, totalling ${formatPaise(totalPaise)} — the sum of the entries listed below.`}{" "}
              Each one is entered as income in the year its date falls under, and the thank-you list
              on the public donate page is made from the same entries.
            </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/donate"
            className="rounded-[4px] border border-line px-3 py-1.5 text-green-900 hover:bg-green-100"
          >
            Public donate page
          </Link>
        </div>
      </div>

      {lockMessage === null && years.closed.length > 0 ? (
        <p className="rounded-[4px] border border-line bg-paper-alt px-3 py-2 text-sm text-ink-muted">
          {listOf(years.closed)}
          &rsquo;s accounts are closed, so a contribution received during it cannot be entered
          here. Enter one against {listOf(years.open)} instead — the year is taken from the day the
          money arrived, not chosen.
        </p>
      ) : null}

      <DonationForm lockMessage={lockMessage} />

      <section className="space-y-3">
        <h2 className="text-lg">What has been recorded</h2>
        {page.items.length > 0 ? (
          <DonationsTable donations={page.items} />
        ) : (
          <p className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted">
            No contribution has been recorded yet. Once one is, its figure appears in the public
            accounts under the year it was received, and the donor&rsquo;s name appears beside it
            only if they agreed to be thanked in public.
          </p>
        )}
      </section>
    </div>
  );
}

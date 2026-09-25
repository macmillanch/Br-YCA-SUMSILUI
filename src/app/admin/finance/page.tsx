import type { Metadata } from "next";
import { FinancialYearForm } from "@/components/admin/FinancialYearForm";
import { FinancialYearsTable } from "@/components/admin/FinancialYearsTable";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { MANAGE_FINANCE, adminYearRows } from "@/lib/finance";

export const metadata: Metadata = { title: "Finance", robots: { index: false } };

export default async function AdminFinancePage() {
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, MANAGE_FINANCE)) {
    return (
      <NotPermitted
        title="Finance"
        body="The year's accounts are kept by the Treasurer. Office-bearers can read the published figures on the site, but the books themselves are not theirs to enter."
      />
    );
  }

  const years = await adminYearRows();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl">Finance</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          A year has to be opened before a voucher can be entered against it. Every figure the public
          reads — the summary, the charts, the ledger, the download, and what each work has cost — is
          totalled from the vouchers entered here, so nothing on this screen is a figure somebody
          typed into a summary box.
        </p>
      </div>

      <FinancialYearForm />

      <section className="space-y-3">
        <h2 className="text-lg">Years kept</h2>
        <FinancialYearsTable years={years} mayReopen={ctx.user.role === "super_admin"} />
      </section>
    </div>
  );
}

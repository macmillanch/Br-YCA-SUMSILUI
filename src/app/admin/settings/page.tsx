import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          These values appear on the public contact, donate and about pages, and in the footer. Only
          a super-admin can save them; anyone else who tries will be refused by the server.
        </p>
      </div>

      <SettingsForm initial={settings} />
    </div>
  );
}

import Link from "next/link";
import { DONATE_NAV, PUBLIC_NAV } from "@/lib/nav";
import { getSettings, type SettingsValues } from "@/lib/settings";

/**
 * A cold Atlas cluster must not take the whole page with it: the shell and the
 * section links still render, and only the contact column reports the failure.
 * Falling back to blank defaults instead would read as "this branch has never
 * published a phone number", which is a different claim from the truth.
 */
async function loadSettings(): Promise<SettingsValues | null> {
  try {
    return await getSettings();
  } catch (error) {
    console.error("footer settings unavailable", error);
    return null;
  }
}

export async function SiteFooter() {
  const settings = await loadSettings();
  const address = settings
    ? [settings.addressLine, settings.district, settings.state].filter(Boolean).join(", ")
    : "";

  return (
    <footer className="mt-16 bg-green-900 text-white">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="font-display text-lg font-semibold">Young Chakma Association</p>
          <p className="mt-1 text-sm text-green-100">
            {settings?.branchName ?? "Sumsilui Branch"} &middot; Mizoram &middot; Est. 1978
          </p>
          {settings?.registrationNo ? (
            <p className="mt-1 text-xs text-white/60">Reg. {settings.registrationNo}</p>
          ) : null}
          <p className="mt-4 max-w-prose text-sm leading-6 text-white/80">
            The branch publishes its notices, works and accounts in public view so that any member
            can see what has been decided, what has been built, and what has been spent.
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-green-100">Sections</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[...PUBLIC_NAV, DONATE_NAV].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-white/90 hover:text-white hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-green-100">Contact</p>
          {settings ? (
            <div className="mt-3 space-y-1.5 text-sm text-white/85">
              {address ? <address className="not-italic">{address}</address> : null}
              {settings.phone ? <p>Phone: {settings.phone}</p> : null}
              {settings.email ? (
                <p>
                  <a href={`mailto:${settings.email}`} className="underline hover:text-white">
                    {settings.email}
                  </a>
                </p>
              ) : null}
              {settings.facebookUrl ? (
                <p>
                  <a
                    href={settings.facebookUrl}
                    rel="me noreferrer"
                    target="_blank"
                    className="underline hover:text-white"
                  >
                    Facebook
                  </a>
                </p>
              ) : null}
              {!settings.phone && !settings.email && !address ? (
                <p className="text-white/60">Not published yet.</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/70">
              Details are temporarily unavailable — please try again.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-white/70">
          <p>
            &copy; {new Date().getFullYear()} {settings?.branchName ?? "Young Chakma Association"}.
            {settings?.footerNote ? ` ${settings.footerNote}` : ""}
          </p>
          <p>
            Office-bearers:{" "}
            <Link href="/admin" className="underline underline-offset-2 hover:text-white">
              sign in
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { DONATE_NAV, PUBLIC_NAV } from "@/lib/nav";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-green-900 text-white">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <p className="font-display text-lg font-semibold">Young Chakma Association</p>
          <p className="mt-1 text-sm text-green-100">Sumsilui Branch &middot; Mizoram &middot; Est. 1978</p>
          <p className="mt-4 max-w-prose text-sm leading-6 text-white/80">
            The branch publishes its notices, works and accounts in public view so that any member can
            see what has been decided, what has been built, and what has been spent.
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-green-100">Sections</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[...PUBLIC_NAV, DONATE_NAV].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-white/90 hover:text-white hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/15">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-white/70">
          <p>&copy; {new Date().getFullYear()} Young Chakma Association, Sumsilui Branch.</p>
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

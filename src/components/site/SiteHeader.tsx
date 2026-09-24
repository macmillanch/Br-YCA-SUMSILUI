import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { DONATE_NAV, PUBLIC_NAV } from "@/lib/nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="container-page flex items-center gap-3 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/yca.jpg"
            alt="Young Chakma Association emblem: a lit oil lamp on a red field inside a green ring."
            width={52}
            height={52}
            priority
            className="h-[52px] w-[52px] shrink-0 rounded-full border border-line object-cover"
          />
          <span className="hidden leading-tight sm:block">
            <span className="block font-display text-[17px] font-semibold text-green-900">
              Young Chakma Association
            </span>
            <span className="block text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              Sumsilui Branch &middot; Mizoram
            </span>
          </span>
        </Link>
        <SiteNav links={PUBLIC_NAV} donate={DONATE_NAV} />
      </div>
    </header>
  );
}

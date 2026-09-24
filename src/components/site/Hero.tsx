import Image from "next/image";
import { Button } from "@/components/ui/Button";

/**
 * The branch's own words, from Settings, when the office-bearers have written
 * them. Until they have, the line says what this website does — a claim the page
 * can make for itself — rather than a mission statement written on the branch's
 * behalf and marked up as though the branch had issued it.
 */
export function Hero({ introduction }: { introduction: string | null }) {
  return (
    <section aria-labelledby="hero-title" className="border-b border-line bg-green-900 text-white">
      <div className="container-page grid items-center gap-8 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:py-16">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-green-100">
            Est. 1978 &middot; Mizoram
          </p>
          <h1
            id="hero-title"
            className="mt-3 font-display text-[30px] leading-[1.15] text-white sm:text-4xl md:text-[44px]"
          >
            Young Chakma Association
            <span className="mt-1 block text-lg font-normal text-green-100 sm:text-xl">
              Sumsilui Branch &middot; Mizoram
            </span>
          </h1>
          <p className="mt-5 max-w-prose text-[15px] leading-7 text-green-100">
            {introduction ??
              "The branch's notices, works and accounts appear here as its office-bearers record them."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="/notices" size="lg" variant="inverse">
              Read latest notices
            </Button>
            <Button href="/works" size="lg" variant="ghostInverse">
              See our works
            </Button>
          </div>
        </div>
        <div className="mx-auto hidden shrink-0 md:block">
          <Image
            src="/yca.jpg"
            alt=""
            width={232}
            height={232}
            priority
            className="h-[232px] w-[232px] rounded-full border-4 border-white/80 object-cover shadow-lg"
          />
          <p className="mt-3 max-w-[232px] text-center text-[11px] leading-5 text-green-100">
            DO HELP &mdash; the association&rsquo;s own words, since 1978.
          </p>
        </div>
      </div>
    </section>
  );
}

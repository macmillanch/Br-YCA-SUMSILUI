import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { DemoFlag } from "@/components/ui/Badge";

export function Hero({ introduction, isSample }: { introduction: string; isSample: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="border-b border-line bg-green-900 text-white">
      <div className="container-page grid items-center gap-8 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:py-16">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-green-100">
            Est. 1978 &middot; Mizoram
            {isSample ? <DemoFlag /> : null}
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
          <p className="mt-5 max-w-prose text-[15px] leading-7 text-green-100">{introduction}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="/notices" size="lg" className="bg-white text-green-900 hover:bg-green-100">
              Read latest notices
            </Button>
            <Button
              href="/works"
              size="lg"
              variant="ghost"
              className="border-green-100/50 bg-transparent text-white hover:bg-white/10"
            >
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

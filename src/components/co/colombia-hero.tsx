import Link from "next/link";

import { CampaignBoard } from "@/components/co/campaign-board";
import { Button } from "@/components/ui/button";
import { colombiaCopy } from "@/lib/colombia-content";
import { COLOMBIA_PATH } from "@/lib/colombia-site";

export function ColombiaHero() {
  const copy = colombiaCopy.hero;
  const [first, second] = copy.title.split("\n");

  return (
    <section className="landing-hero px-4 py-14 sm:py-16 md:py-24">
      <div className="container grid items-center gap-10 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-14">
        <div className="landing-hero-copy">
          <p className="mb-4 text-[0.72rem] font-semibold tracking-[0.16em] text-white/80">
            {copy.eyebrow}
          </p>
          <h1 className="hero-title mb-5 max-w-[12ch]">
            {first}
            <br />
            {second}
          </h1>
          <p className="landing-hero-muted mb-8 max-w-[48ch] text-pretty text-[1.0625rem] font-normal leading-[1.55] tracking-[-0.01em]">
            {copy.subtitle}
          </p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href={`${COLOMBIA_PATH}#demostracion`}>{copy.ctaPrimary}</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
              asChild
            >
              <Link href={`${COLOMBIA_PATH}#como-funciona`}>{copy.ctaSecondary}</Link>
            </Button>
          </div>
          <p className="landing-hero-muted mt-5 max-w-[46ch] text-sm leading-relaxed">
            {copy.audience}
          </p>
        </div>
        <CampaignBoard />
      </div>
    </section>
  );
}

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { colombiaCopy } from "@/lib/colombia-content";
import { COLOMBIA_PATH } from "@/lib/colombia-site";

export function VolumeCTA() {
  const copy = colombiaCopy.volume;

  return (
    <section className="landing-band scroll-mt-24 px-4 py-16 sm:py-20">
      <div className="container max-w-3xl">
        <h2 className="section-title mb-4 max-w-[22ch]">{copy.title}</h2>
        <p className="max-w-[65ch] leading-relaxed text-muted-foreground">{copy.body}</p>
        <p className="mt-8">
          <Button size="lg" asChild>
            <Link href={`${COLOMBIA_PATH}?pedido=propuesta#demostracion`}>{copy.cta}</Link>
          </Button>
        </p>
        <p className="mt-4 max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
          {copy.note}
        </p>
      </div>
    </section>
  );
}

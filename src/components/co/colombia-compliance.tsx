import Link from "next/link";

import { colombiaCopy } from "@/lib/colombia-content";
import { COLOMBIA_FRAMEWORK_PATH, COLOMBIA_PRIVACY_PATH } from "@/lib/colombia-site";

export function ColombiaCompliance() {
  const copy = colombiaCopy.compliance;
  const links = [COLOMBIA_FRAMEWORK_PATH, null, COLOMBIA_PRIVACY_PATH] as const;

  return (
    <section id="compliance" className="landing-band scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
      <div className="container">
        <p className="mb-3 text-[0.72rem] font-semibold tracking-[0.14em] text-primary">
          {copy.eyebrow}
        </p>
        <h2 className="section-title mb-4 max-w-[22ch]">{copy.title}</h2>
        <p className="mb-10 max-w-[65ch] leading-relaxed text-muted-foreground">{copy.body}</p>

        <div className="grid gap-6 lg:grid-cols-3">
          {copy.blocks.map((block, index) => (
            <article
              key={block.title}
              className="border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0 lg:first:border-l-0 lg:first:pl-0"
            >
              <h3 className="feature-title">{block.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{block.body}</p>
              {block.extra ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{block.extra}</p>
              ) : null}
              {block.linkLabel && links[index] ? (
                <p className="mt-4">
                  <Link
                    href={links[index] as string}
                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {block.linkLabel}
                  </Link>
                </p>
              ) : null}
            </article>
          ))}
        </div>

        <p className="mt-10 max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
          {copy.disclaimer}
        </p>
      </div>
    </section>
  );
}

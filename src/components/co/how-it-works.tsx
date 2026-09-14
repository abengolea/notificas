import { colombiaCopy } from "@/lib/colombia-content";

export function HowItWorks() {
  const copy = colombiaCopy.how;

  return (
    <section id="como-funciona" className="landing-band scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
      <div className="container">
        <h2 className="section-title mb-10 max-w-[24ch]">{copy.title}</h2>
        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="relative min-w-0">
              <p className="font-mono text-sm font-medium tabular-nums text-primary">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="feature-title mt-3">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          {copy.apiNote}
        </p>
      </div>
    </section>
  );
}

import { colombiaCopy } from "@/lib/colombia-content";

export function PainPoints() {
  const copy = colombiaCopy.pain;
  const [first, second] = copy.title.split("\n");

  return (
    <section id="producto" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
      <div className="container">
        <h2 className="section-title mb-4 max-w-[22ch]">
          {first}
          <span className="mt-1 block">{second}</span>
        </h2>
        <p className="mb-10 max-w-[65ch] leading-relaxed text-muted-foreground">{copy.body}</p>

        <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          {copy.items.map((item) => (
            <li key={item.title} className="bg-card px-5 py-6 sm:px-6">
              <h3 className="feature-title">{item.title}</h3>
              <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                {item.body}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-10 max-w-3xl border-t border-border pt-8">
          <p className="text-[0.72rem] font-semibold tracking-[0.14em] text-primary">
            {copy.solutionEyebrow}
          </p>
          <p className="mt-3 font-headline text-2xl font-bold tracking-[-0.03em] sm:text-[1.75rem]">
            {copy.solutionTitle}
          </p>
          <p className="mt-3 max-w-[65ch] leading-relaxed text-muted-foreground">
            {copy.solutionBody}
          </p>
        </div>
      </div>
    </section>
  );
}

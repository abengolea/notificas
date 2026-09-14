import { colombiaCopy } from "@/lib/colombia-content";

export function CollectionUseCases() {
  const copy = colombiaCopy.useCases;

  return (
    <section id="cobranza" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
      <div className="container">
        <p className="mb-3 text-[0.72rem] font-semibold tracking-[0.14em] text-primary">
          {copy.eyebrow}
        </p>
        <h2 className="section-title mb-4 max-w-[22ch]">{copy.title}</h2>
        <p className="mb-10 max-w-[65ch] leading-relaxed text-muted-foreground">{copy.body}</p>

        <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {copy.items.map((item) => (
            <li key={item.title} className="max-w-[42ch] border-t border-border pt-4">
              <h3 className="feature-title">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
          {copy.note}
        </p>
      </div>
    </section>
  );
}

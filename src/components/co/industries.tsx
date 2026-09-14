import { colombiaCopy } from "@/lib/colombia-content";

export function Industries() {
  const copy = colombiaCopy.industries;

  return (
    <section className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
      <div className="container">
        <h2 className="section-title mb-10 max-w-[22ch]">{copy.title}</h2>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {copy.items.map((item) => (
            <li
              key={item.title}
              className="min-h-[10.5rem] border-t border-border pt-5"
            >
              <h3 className="font-headline text-xl font-bold tracking-[-0.03em]">{item.title}</h3>
              <p className="mt-3 max-w-[40ch] leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

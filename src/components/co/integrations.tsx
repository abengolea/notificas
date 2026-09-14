import { colombiaCopy } from "@/lib/colombia-content";

export function Integrations() {
  const copy = colombiaCopy.integrations;

  return (
    <section
      id="integraciones"
      className="scroll-mt-24 bg-[hsl(208_28%_96%)] px-4 py-16 sm:py-20 md:py-24 dark:bg-[hsl(215_28%_14%)]"
    >
      <div className="container">
        <h2 className="section-title mb-4 max-w-[20ch]">{copy.title}</h2>
        <p className="mb-10 max-w-[65ch] leading-relaxed text-muted-foreground">{copy.body}</p>

        <ol className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2">
          {copy.pipeline.map((node, index) => (
            <li key={node} className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold">
                {node}
              </span>
              {index < copy.pipeline.length - 1 ? (
                <span className="hidden text-muted-foreground md:inline" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>

        <ul className="mt-8 flex flex-wrap gap-2">
          {copy.chips.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold tracking-wide"
            >
              {chip}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

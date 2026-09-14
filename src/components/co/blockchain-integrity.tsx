import { colombiaCopy } from "@/lib/colombia-content";

export function BlockchainIntegrity() {
  const copy = colombiaCopy.blockchain;

  return (
    <section id="seguridad" className="scroll-mt-24 px-4 py-16 sm:py-20">
      <div className="container max-w-4xl">
        <h2 className="section-title mb-4">{copy.title}</h2>
        <p className="max-w-[65ch] leading-relaxed text-muted-foreground">{copy.body}</p>
        <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
          {copy.privacy}
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-4">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="min-w-0">
              <p className="font-mono text-xs tabular-nums text-primary">
                {index < copy.steps.length - 1 ? `${index + 1} →` : String(index + 1)}
              </p>
              <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

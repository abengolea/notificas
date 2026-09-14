import { colombiaCopy } from "@/lib/colombia-content";

function EvidenceDossier() {
  const mock = colombiaCopy.evidence.mock;
  const caption = colombiaCopy.evidence.mockCaption;

  return (
    <figure>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_16px_36px_-20px_rgba(15,23,42,0.45)]">
      <div className="border-b border-border bg-[hsl(210_16%_97%)] px-5 py-4 dark:bg-[hsl(215_24%_16%)]">
        <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-primary">{mock.kicker}</p>
        <p className="mt-1 font-headline text-xl font-bold tracking-[-0.03em]">{mock.heading}</p>
        <p className="mt-1 text-sm text-muted-foreground">{mock.campaign}</p>
      </div>
      <dl className="grid gap-px bg-border sm:grid-cols-2">
        <div className="bg-card px-5 py-4">
          <dt className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Destinatario
          </dt>
          <dd className="mt-1 font-semibold">{mock.recipient}</dd>
        </div>
        <div className="bg-card px-5 py-4">
          <dt className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Canal
          </dt>
          <dd className="mt-1 font-semibold">{mock.channel}</dd>
        </div>
        <div className="bg-card px-5 py-4">
          <dt className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Fecha y hora
          </dt>
          <dd className="mt-1 font-semibold tabular-nums">{mock.sentAt}</dd>
        </div>
        <div className="bg-card px-5 py-4">
          <dt className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Verificación
          </dt>
          <dd className="mt-1 font-mono text-sm">{mock.verify}</dd>
        </div>
      </dl>
      <ol className="space-y-3 px-5 py-5">
        {mock.events.map((event) => (
          <li key={event.label} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="font-medium">{event.label}</span>
            <span className="font-mono tabular-nums text-muted-foreground">{event.detail}</span>
          </li>
        ))}
      </ol>
      <p className="border-t border-border px-5 py-4 font-mono text-xs text-muted-foreground">
        Hash · {mock.hash}
      </p>
      </div>
      <figcaption className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}

export function EvidenceSection() {
  const copy = colombiaCopy.evidence;
  const [first, second] = copy.title.split("\n");

  return (
    <section id="evidencia" className="landing-band scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
      <div className="container grid items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
        <div>
          <h2 className="section-title mb-4 max-w-[14ch]">
            {first}
            <span className="mt-1 block">{second}</span>
          </h2>
          <p className="mb-8 max-w-[54ch] leading-relaxed text-muted-foreground">{copy.body}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {copy.items.map((item) => (
              <li key={item} className="border-b border-border/80 py-2 text-sm font-medium">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <EvidenceDossier />
      </div>
    </section>
  );
}

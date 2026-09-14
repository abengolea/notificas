import { colombiaCopy } from "@/lib/colombia-content";

export function CampaignBoard() {
  const mock = colombiaCopy.campaignMock;

  return (
    <figure className="landing-hero-proof relative mx-auto w-full max-w-[34rem] lg:mx-0 lg:max-w-none">
      <div
        className="overflow-hidden rounded-lg border border-white/15 bg-[hsl(210_20%_98%)] text-[hsl(215_28%_18%)] shadow-[0_22px_48px_-18px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[hsl(210_20%_88%)] bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-[hsl(208_38%_32%)]">
              {mock.product} · {mock.workspace}
            </p>
            <p className="mt-1 truncate font-headline text-lg font-bold tracking-[-0.03em] sm:text-xl">
              {mock.campaign}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[hsl(186_78%_37%/0.12)] px-2.5 py-1 text-[0.7rem] font-semibold text-[hsl(186_78%_28%)]">
            {mock.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[hsl(210_20%_88%)] sm:grid-cols-4">
          <p className="bg-white px-4 py-3 text-sm sm:px-5">
            <span className="block text-[0.7rem] font-medium uppercase leading-tight tracking-[0.06em] text-[hsl(215_20%_40%)]">
              Destinatarios
            </span>
            <span className="mt-1 block font-headline text-xl font-bold tabular-nums tracking-tight sm:text-[1.35rem]">
              {mock.recipients.replace(" destinatarios", "")}
            </span>
          </p>
          <p className="bg-white px-4 py-3 text-sm sm:col-span-3 sm:px-5">
            <span className="block text-[0.7rem] font-medium uppercase leading-tight tracking-[0.06em] text-[hsl(215_20%_40%)]">
              Canales
            </span>
            <span className="mt-1 block font-semibold">{mock.channels}</span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-px bg-[hsl(210_20%_88%)] sm:grid-cols-4">
          {mock.metrics.map((metric) => (
            <div key={metric.label} className="bg-[hsl(210_16%_97%)] px-4 py-3 sm:px-5">
              <dt className="text-[0.7rem] font-medium leading-snug text-[hsl(215_20%_40%)] sm:whitespace-normal">
                {metric.label}
              </dt>
              <dd className="mt-1 font-headline text-lg font-bold tabular-nums tracking-tight sm:text-xl">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="hidden border-t border-[hsl(210_20%_88%)] bg-white px-4 py-3 sm:block sm:px-5">
          <table className="w-full text-left text-[0.8rem]">
            <caption className="sr-only">Destinatarios de ejemplo</caption>
            <thead>
              <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[hsl(215_20%_42%)]">
                <th className="pb-2 pr-3 font-semibold">Destinatario</th>
                <th className="pb-2 pr-3 font-semibold">Referencia</th>
                <th className="pb-2 pr-3 font-semibold">Canal</th>
                <th className="pb-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {mock.rows.map((row) => (
                <tr key={row.ref} className="border-t border-[hsl(210_20%_92%)]">
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3 font-mono text-[0.75rem] text-[hsl(215_20%_38%)]">
                    {row.ref}
                  </td>
                  <td className="py-2 pr-3">{row.channel}</td>
                  <td className="py-2">{row.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="flex flex-wrap gap-2 border-t border-[hsl(210_20%_88%)] bg-[hsl(210_16%_97%)] px-4 py-3 sm:px-5">
          {mock.chips.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-[hsl(186_40%_72%)] bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-[hsl(186_50%_26%)]"
            >
              {chip}
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="landing-hero-muted mt-3 text-center text-[0.72rem] leading-relaxed lg:text-left">
        {colombiaCopy.hero.mockCaption}
      </figcaption>
    </figure>
  );
}

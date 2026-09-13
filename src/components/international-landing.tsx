import { Logo } from "@/components/logo";
import { FlagArgentina, FlagBrazil, FlagColombia } from "@/components/country-flags";
import {
  ARGENTINA_ORIGIN,
  INTERNATIONAL_COUNTRIES,
  type InternationalCountryId,
} from "@/lib/international-site";
import { LEGACY_ARCHIVO_LOGIN_HREF } from "@/lib/legacy-archivo";
import { SITE_CONTACT } from "@/lib/seo";

function CountryFlag({ id }: { id: InternationalCountryId }) {
  if (id === "AR") return <FlagArgentina />;
  if (id === "BR") return <FlagBrazil />;
  return <FlagColombia />;
}

function CountryChoice({
  id,
  name,
  status,
  href,
}: {
  id: InternationalCountryId;
  name: string;
  status: string;
  href: string | null;
}) {
  const inner = (
    <>
      <span className="intl-flag overflow-hidden rounded-md shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
        <CountryFlag id={id} />
      </span>
      <span className="mt-4 block text-lg font-semibold tracking-tight text-white">{name}</span>
      <span className="mt-1 block text-sm text-[hsl(186_18%_86%)]">{status}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="intl-country group flex w-full max-w-[13.5rem] flex-col items-center rounded-lg px-2 py-3 text-center outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(208_38%_20%)]"
      >
        {inner}
      </a>
    );
  }

  return (
    <div className="intl-country intl-country-soon flex w-full max-w-[13.5rem] flex-col items-center px-2 py-3 text-center">
      {inner}
    </div>
  );
}

export function InternationalLanding() {
  return (
    <div className="intl-gate landing-hero flex min-h-dvh flex-col text-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-6 pt-8 sm:px-10 sm:pt-10">
        <Logo className="h-11 w-11 rounded-md bg-white sm:h-12 sm:w-12" />
        <p className="text-lg font-bold tracking-tight sm:text-xl">Notificas</p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        <h1 className="max-w-[18ch] text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-tight">
          Comunicaciones digitales verificables
        </h1>
        <p className="landing-hero-muted mt-5 max-w-[36ch] text-pretty text-center text-base leading-relaxed sm:text-lg">
          Elegí tu país. Escolha seu país.
        </p>
        <p className="landing-hero-muted mt-2 max-w-[42ch] text-pretty text-center text-sm leading-relaxed sm:text-base">
          Hoy operamos en Argentina. Brasil y Colombia, pronto.
        </p>

        <ul className="mt-12 flex w-full max-w-3xl flex-col items-center gap-10 sm:mt-14 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
          {INTERNATIONAL_COUNTRIES.map((country) => (
            <li key={country.id} className="flex justify-center">
              <CountryChoice {...country} />
            </li>
          ))}
        </ul>
      </main>

      <footer className="space-y-2 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-center text-sm leading-relaxed sm:px-10">
        <p className="landing-hero-muted">
          ¿Usabas la web anterior?{" "}
          <a
            href={`${ARGENTINA_ORIGIN}${LEGACY_ARCHIVO_LOGIN_HREF}`}
            className="font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
          >
            Consultar envíos anteriores
          </a>
        </p>
        <p>
          <a
            href={`mailto:${SITE_CONTACT.email}`}
            className="landing-hero-muted underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white"
          >
            {SITE_CONTACT.email}
          </a>
        </p>
      </footer>
    </div>
  );
}

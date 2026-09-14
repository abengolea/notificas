import { Logo } from "@/components/logo";
import { CountryFlagImage } from "@/components/country-flags";
import {
  ARGENTINA_ORIGIN,
  INTERNATIONAL_COUNTRIES,
  type InternationalCountryId,
} from "@/lib/international-site";
import { LEGACY_ARCHIVO_LOGIN_HREF } from "@/lib/legacy-archivo";
import { SITE_CONTACT } from "@/lib/seo";

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
  const live = Boolean(href);
  const inner = (
    <>
      <span className={`intl-flag${live ? " intl-flag-live" : ""}`}>
        <CountryFlagImage id={id} />
      </span>
      <span className="mt-5 block text-[1.05rem] font-semibold tracking-tight text-white sm:text-lg">
        {name}
      </span>
      <span className={`mt-1 block text-sm ${live ? "font-medium text-white" : "text-[hsl(186_22%_82%)]"}`}>
        {status}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="intl-country intl-country-live group flex w-full max-w-[15rem] flex-col items-center rounded-lg px-2 py-3 text-center outline-none transition-transform duration-300 hover:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(208_38%_20%)]"
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
    <div className="intl-gate landing-hero relative flex min-h-dvh flex-col overflow-hidden text-[hsl(210_20%_98%)]">
      <div className="intl-atmosphere" aria-hidden>
        <img src="/intl/paper.png" alt="" className="intl-atmosphere-img" />
      </div>

      <header className="relative z-10 flex items-center px-6 pt-8 sm:px-10 sm:pt-10">
        <Logo
          variant="wordmark"
          onDark
          className="h-16 w-auto max-w-[min(100%,22rem)] sm:h-[4.75rem] sm:max-w-[28rem]"
        />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        <h1 className="hero-title max-w-[16ch] text-center">
          Comunicaciones digitales verificables
        </h1>
        <p className="landing-hero-muted mt-6 max-w-[38ch] text-pretty text-center text-lg font-normal leading-[1.55] tracking-[-0.01em]">
          Elegí tu país. Escolha seu país.
        </p>
        <p className="landing-hero-muted mt-2 max-w-[44ch] text-pretty text-center text-sm leading-relaxed sm:text-base">
          Argentina y Brasil están online. Colombia, próximamente.
        </p>

        <ul className="mt-14 flex w-full max-w-4xl flex-col items-center gap-12 sm:mt-16 sm:flex-row sm:items-end sm:justify-center sm:gap-10">
          {INTERNATIONAL_COUNTRIES.map((country) => (
            <li key={country.id} className="flex justify-center">
              <CountryChoice {...country} />
            </li>
          ))}
        </ul>
      </main>

      <footer className="relative z-10 space-y-2 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center text-sm leading-relaxed sm:px-10">
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

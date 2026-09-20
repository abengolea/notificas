import { Logo } from "@/components/logo";
import { IntlDemoForm } from "@/components/intl-demo-form";
import { Button } from "@/components/ui/button";
import {
  ARGENTINA_ORIGIN,
  INTERNATIONAL_COUNTRIES,
} from "@/lib/international-site";
import { LEGACY_ARCHIVO_LOGIN_HREF } from "@/lib/legacy-archivo";
import { SITE_CONTACT } from "@/lib/seo";

/**
 * THESIS: Notificas.com is the product, not a country picker; flags are the category default this page refuses.
 * OWN-WORLD: navy paper field, wordmark, white display, muted cyan body, one blue action.
 * STORY: what the platform proves, then a demo; country is a form field.
 * FIRST VIEWPORT: wordmark, ES/PT text, 28–40px title, bajada, primary CTA.
 * FORM: established intl-gate world; product composition; code-led.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
 */

const STEPS = [
  {
    title: "Enviar",
    body: "WhatsApp o email, con el contenido, el destinatario y la fecha registrados desde una sola plataforma.",
  },
  {
    title: "Conservar",
    body: "Queda evidencia verificable de qué se comunicó, cuándo y a quién. No depende de capturas ni de bandejas ajenas.",
  },
  {
    title: "Comprobar",
    body: "La constancia se puede revisar después, en una verificación pública, sin rearmar el expediente a mano.",
  },
];

const USE_CASES = [
  "Cobranzas, intimaciones y cambios de condiciones",
  "Documentación laboral y avisos a personal",
  "Protocolos, capacitaciones e instrucciones operativas",
  "Requerimientos a contratistas y proveedores",
];

export function InternationalLanding() {
  return (
    <div className="intl-gate landing-hero relative flex min-h-dvh flex-col text-[hsl(210_20%_98%)]">
      <div className="intl-atmosphere" aria-hidden>
        <img src="/intl/paper.png" alt="" className="intl-atmosphere-img" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-4 px-6 pt-8 sm:px-10 sm:pt-10">
        <Logo
          variant="wordmark"
          onDark
          className="h-14 w-auto max-w-[min(100%,18rem)] sm:h-16 sm:max-w-[22rem]"
        />
        <nav aria-label="Idioma" className="flex items-center gap-2 text-sm tracking-wide text-[hsl(186_18%_86%)]">
          <span className="font-semibold text-white" aria-current="page">
            ES
          </span>
          <span aria-hidden>·</span>
          <a href="/br" className="hover:text-white">
            PT
          </a>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-16 pt-12 sm:px-10 sm:pt-16">
        <section className="landing-hero-copy max-w-[38rem]">
          <h1 className="hero-title max-w-[14ch]">
            Comunicaciones digitales verificables
          </h1>
          <p className="landing-hero-muted mt-6 max-w-[42ch] text-pretty text-lg font-normal leading-[1.55] tracking-[-0.01em]">
            Evidencia de qué se comunicó, cuándo y a quién, por WhatsApp y email. Para operaciones que no pueden depender de un correo común.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" asChild>
              <a href="#demostracion">Coordinar una demostración</a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              asChild
            >
              <a href="#como-funciona">Cómo funciona</a>
            </Button>
          </div>
        </section>

        <section id="como-funciona" className="mt-20 scroll-mt-8 sm:mt-24">
          <h2 className="text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.5rem]">
            De la comunicación a la evidencia
          </h2>
          <ol className="mt-8 max-w-3xl space-y-8">
            {STEPS.map((step) => (
              <li key={step.title}>
                <p className="text-lg font-semibold tracking-tight text-white">{step.title}</p>
                <p className="landing-hero-muted mt-2 max-w-[62ch] text-[1.05rem] leading-[1.55]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 max-w-3xl border border-white/15 bg-white/[0.04] px-6 py-7 sm:px-8">
          <h2 className="text-[1.2rem] font-semibold tracking-tight text-white">
            Dónde se usa
          </h2>
          <ul className="mt-5 space-y-3">
            {USE_CASES.map((row) => (
              <li key={row} className="flex gap-3 text-[1.05rem] leading-[1.55] text-[hsl(186_18%_86%)]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(186_50%_52%)]" aria-hidden />
                {row}
              </li>
            ))}
          </ul>
        </section>

        <section id="demostracion" className="mt-20 max-w-3xl scroll-mt-8 sm:mt-24">
          <h2 className="text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.5rem]">
            Coordinar una demostración
          </h2>
          <p className="landing-hero-muted mt-3 max-w-[52ch] leading-[1.55]">
            El país se indica acá, para armar la conversación. No hace falta elegir un mercado antes de entender el producto.
          </p>
          <div className="mt-8">
            <IntlDemoForm />
          </div>
        </section>
      </main>

      <footer className="relative z-10 space-y-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 text-sm leading-relaxed sm:px-10">
        <p className="landing-hero-muted">
          {INTERNATIONAL_COUNTRIES.map((country, index) => (
            <span key={country.id}>
              {index > 0 ? " · " : null}
              {country.href ? (
                <a href={country.href} className="text-white underline decoration-white/35 underline-offset-4 hover:decoration-white">
                  {country.name}
                </a>
              ) : (
                country.name
              )}
            </span>
          ))}
          <span> · Latinoamérica</span>
        </p>
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

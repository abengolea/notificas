import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  ArrowRight,
  Mail,
  ChevronDown,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { FaqSection } from '@/components/faq-section';
import { QuoteContactForm } from '@/components/footer-contact-form';
import { EnterpriseValuePanel } from '@/components/enterprise-value-panel';
import { LandingHeader } from '@/components/landing-header';
import { InternationalLanding } from '@/components/international-landing';
import { JsonLd } from '@/components/json-ld';
import { PublicFooter } from '@/components/public-footer';
import {
  hostnameFromRequestHeaders,
  internationalLandingMetadata,
  isInternationalHost,
} from '@/lib/international-site';
import { createPageMetadata } from '@/lib/seo';
import {
  faqPageJsonLd,
  organizationJsonLd,
  serviceJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from '@/lib/structured-data';

const HOME_TITLE =
  'Notificas | Comunicaciones digitales verificables por WhatsApp y email';
const HOME_DESCRIPTION =
  'Plataforma argentina para comunicaciones digitales verificables por WhatsApp y email. Evidencia técnica, trazabilidad de eventos y verificación pública de constancias.';

const ARGENTINA_METADATA: Metadata = {
  ...createPageMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: '/',
    keywords: [
      'notificaciones fehacientes',
      'carta documento digital',
      'notificación certificada',
      'blockchain Polygon',
      'Notificas Argentina',
      'notificaciones de alto volumen',
      'notificaciones WhatsApp empresas',
      'notificaciones por email',
      'notificaciones digitales certificadas',
      'notificaciones blockchain',
      'gestión de mora WhatsApp',
      'intimaciones digitales',
      'comunicaciones empresariales certificadas',
      'notificaciones masivas para empresas',
    ],
  }),
  title: { absolute: HOME_TITLE },
};

export async function generateMetadata(): Promise<Metadata> {
  const host = hostnameFromRequestHeaders(await headers());
  if (isInternationalHost(host)) {
    return internationalLandingMetadata(true);
  }
  return ARGENTINA_METADATA;
}

const features: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Huella pública',
    description:
      'De cada mensaje queda una huella en Polygon. Esa huella no se puede cambiar. El texto y los eventos se conservan 5 años en Notificas.',
  },
  {
    icon: ArrowRight,
    title: 'Trazabilidad por canal',
    description:
      'Anotamos si el correo salió o rebotó, si WhatsApp llegó al celular o se leyó, y si abrieron el enlace. Cada hecho se puede comprobar después.',
  },
  {
    icon: FileText,
    title: 'PDF para el expediente',
    description:
      'Bajás un certificado para un reclamo o un juicio. Un juez decide qué valor le da. Se emite una sola vez, como una foto de ese momento.',
  },
];

const certifiedChannels: {
  icon: LucideIcon;
  title: string;
  outline: string;
  events: { title: string; description: string }[];
}[] = [
  {
    icon: Mail,
    title: 'Correo',
    outline: 'Envío, acceso al enlace y lectura en pantalla',
    events: [
      {
        title: 'Envío',
        description:
          'Qué texto salió, a quién y cuándo. Si el servidor de correo lo tomó para enviar, queda anotado. Eso no significa que haya llegado a la bandeja.',
      },
      {
        title: 'Acceso al enlace',
        description:
          'El primer click al enlace de lectura, si ocurre. No es “abrió el correo en Gmail o Outlook”.',
      },
      {
        title: 'Lectura confirmada',
        description: 'La persona confirma en nuestra pantalla de lectura.',
      },
    ],
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    outline: 'Aviso enviado, entrega al teléfono y lectura',
    events: [
      {
        title: 'Aviso enviado',
        description:
          'Se registra la plantilla que Meta aprobó, con los datos de esa persona. No es la carta completa, salvo que la plantilla sea ese texto.',
      },
      {
        title: 'Entrega',
        description: 'Meta avisa si el aviso llegó al teléfono.',
      },
      {
        title: 'Lectura',
        description:
          'Meta marca el aviso como leído. Es un hecho distinto al de la pantalla de correo.',
      },
    ],
  },
];

export default async function LandingPage() {
  const host = hostnameFromRequestHeaders(await headers());
  if (isInternationalHost(host)) {
    return <InternationalLanding />;
  }

  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={softwareApplicationJsonLd()} />
      <JsonLd data={serviceJsonLd()} />
      <JsonLd data={faqPageJsonLd()} />
      <LandingHeader />

      <main className="flex-1">
        <section className="landing-hero px-4 py-16 sm:py-20 md:py-24">
          <div className="container grid items-start gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.75fr)] lg:gap-12">
            <div className="landing-hero-copy">
              <h1 className="hero-title mb-5">
                Notificas: comunicaciones
                <br className="hidden lg:block" /> digitales verificables
                <br className="hidden lg:block" /> por WhatsApp y email
              </h1>
              <p className="landing-hero-muted mb-8 max-w-[65ch] text-pretty text-[1.0625rem] font-normal leading-[1.55] tracking-[-0.01em]">
                Plataforma argentina para empresas y profesionales. Certificamos correo y WhatsApp por separado: qué se envió, a quién, cuándo, y lo que cada canal informe después. Más rápido y económico que una carta documento en la operación cotidiana; no la reemplaza si la ley pide esa forma.
              </p>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/signup">Empezá ahora</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
                  asChild
                >
                  <Link href="/#empresas">Soluciones para empresas</Link>
                </Button>
              </div>
            </div>

            <aside className="landing-hero-proof" aria-label="Qué se certifica en cada canal">
              <p className="text-lg font-semibold tracking-tight text-white">
                Certificamos correo y WhatsApp
              </p>
              <p className="landing-hero-muted mt-1 max-w-[48ch] text-sm leading-relaxed">
                Enviás por uno o por los dos. Cada canal deja su propio rastro.
              </p>

              <div className="mt-5 border-t border-white/15">
                {certifiedChannels.map((channel) => (
                  <details key={channel.title} className="group border-b border-white/15 open:[&_svg]:rotate-180">
                    <summary className="flex cursor-pointer list-none items-start gap-3 py-3.5 outline-none [&::-webkit-details-marker]:hidden [&::marker]:content-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(208_38%_20%)]">
                      <channel.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-white">{channel.title}</span>
                        <span className="landing-hero-muted mt-0.5 block text-sm font-normal">
                          {channel.outline}
                        </span>
                      </span>
                      <ChevronDown
                        className="mt-1 h-4 w-4 shrink-0 text-white/80 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden
                      />
                    </summary>
                    <ol className="border-l border-white/20 pb-4 pl-5">
                      {channel.events.map((event) => (
                        <li key={event.title} className="pb-3 last:pb-0">
                          <p className="font-medium leading-snug text-white">{event.title}</p>
                          <p className="landing-hero-muted mt-0.5 text-sm leading-relaxed">
                            {event.description}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>

              <div className="pt-5">
                <p className="flex items-center gap-2 font-semibold text-white">
                  <FileText className="h-4 w-4" aria-hidden />
                  Certificado PDF
                </p>
                <p className="landing-hero-muted mt-1 max-w-[48ch] text-sm leading-relaxed">
                  Lo emitís una sola vez, como una foto. Incluye lo registrado —correo, WhatsApp o ambos— hasta ese instante. Lo que pase después no entra en ese archivo.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section id="ventajas" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <h2 className="section-title mb-10 max-w-3xl md:mb-14">
              Qué queda de cada envío
            </h2>
            <div className="grid gap-x-12 gap-y-10 md:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="max-w-[48ch]">
                  <h3 className="feature-title flex items-start gap-3">
                    <feature.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    {feature.title}
                  </h3>
                  <p className="mt-2 pl-8 leading-relaxed text-muted-foreground">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="empresas" className="scroll-mt-24 px-4 pt-16 pb-16 sm:pt-20 md:pt-24 md:pb-20">
          <div className="container">
            <div className="mb-10 max-w-3xl md:mb-12">
              <h2 className="section-title mb-4">Soluciones para empresas</h2>
              <p className="max-w-[65ch] leading-relaxed text-muted-foreground">
                Campañas de cientos o miles de notificaciones por WhatsApp o correo, con seguimiento de cada destinatario. Se cotizan caso por caso.
              </p>
              <p className="mt-3">
                <Link
                  href="/notificaciones-masivas-empresas"
                  className="font-medium text-foreground visited:text-foreground underline-offset-4 hover:underline"
                >
                  Cómo funcionan los envíos de volumen
                </Link>
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Empresas, estudios y organizaciones. Cotización personalizada para campañas de volumen.
              </p>
            </div>
            <div
              id="cotizacion"
              className="scroll-mt-24 grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-2 dark:border-white/10 dark:bg-[hsl(215_28%_22%)]"
            >
              <div className="border-border p-6 sm:p-8 lg:border-r dark:border-white/10">
                <h3 className="font-headline text-xl font-bold tracking-[-0.025em] text-foreground">
                  Solicitar cotización
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Contanos el volumen de notificaciones, canal y características de la comunicación.
                </p>
                <div className="mt-6">
                  <QuoteContactForm />
                </div>
              </div>
              <EnterpriseValuePanel />
            </div>
          </div>
        </section>

        <FaqSection />
      </main>
      <PublicFooter variant="full" />
    </div>
  );
}

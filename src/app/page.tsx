import type { Metadata } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckCircle,
  ShieldCheck,
  Cpu,
  ArrowRight,
  Mail,
  Send,
  Phone,
  Search,
  MessageCircle,
  FileText,
  Users,
  Link2,
  Inbox,
} from 'lucide-react';
import { FaqSection } from '@/components/faq-section';
import { FooterContactForm, QuoteContactForm } from '@/components/footer-contact-form';
import { LandingHeader } from '@/components/landing-header';
import { JsonLd } from '@/components/json-ld';
import { createPageMetadata, SEO_GUIDE_PAGES } from '@/lib/seo';
import {
  faqPageJsonLd,
  organizationJsonLd,
  serviceJsonLd,
  websiteJsonLd,
} from '@/lib/structured-data';

const HOME_TITLE =
  'Notificas | Notificaciones fehacientes digitales certificadas en blockchain';
const HOME_DESCRIPTION =
  'Enviá un mensaje y dejá constancia de qué salió, a quién y cuándo. El certificado de lectura se emite una sola vez. Campañas de volumen por WhatsApp y correo, previa cotización.';

export const metadata: Metadata = {
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

const features: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Comunicaciones certificadas',
    description: 'De cada mensaje queda una huella en una red pública (Polygon). Esa huella no se puede cambiar. El texto y los eventos se conservan 5 años en Notificas.',
  },
  {
    icon: Send,
    title: 'Envíos',
    description: 'Las notificaciones individuales son procesadas inmediatamente. Las campañas corporativas y de alto volumen se ejecutan progresivamente de acuerdo con las condiciones técnicas y la capacidad disponible de WhatsApp o Email.',
  },
  {
    icon: Cpu,
    title: 'Costos',
    description: 'Más económico y rápido que una carta documento, con un rastro comprobable. No la reemplaza si la ley pide esa forma.',
  },
  {
    icon: ArrowRight,
    title: 'Trazabilidad completa',
    description: 'Anotamos si el correo salió o rebotó, si WhatsApp llegó al celular o se leyó, y si abrieron el enlace. Cada hecho se puede comprobar después.',
  },
  {
    icon: ShieldCheck,
    title: 'Prueba en juicio',
    description: 'Bajás un PDF para un expediente. Un juez decide qué valor le da. El certificado de lectura es una foto de ese momento: se emite una sola vez.',
  },
  {
    icon: ShieldCheck,
    title: 'Almacenamiento',
    description: 'Adjuntos, PDFs y el texto del envío se guardan 5 años y no se borran a pedido. Lo publicado en Polygon queda para siempre.',
  },
];

const certifiedEvents: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Send,
    title: 'Envío',
    description: 'Qué texto salió, a quién y cuándo. Si el servidor de correo lo tomó para enviar, queda anotado. Eso no significa que haya llegado a la bandeja.',
  },
  {
    icon: MessageCircle,
    title: 'Notificación por WhatsApp',
    description: 'Se registra la plantilla que Meta aprobó, con los datos de esa persona. Meta avisa si llegó al teléfono o si lo leyeron. No es la carta completa, salvo que la plantilla sea ese texto.',
  },
  {
    icon: Inbox,
    title: 'Recepción',
    description: 'El primer click al enlace de la notificación, si ocurre. No es “abrió el correo en Gmail o Outlook”.',
  },
  {
    icon: CheckCircle,
    title: 'Lectura confirmada',
    description: 'O la persona confirma en nuestra pantalla de lectura, o WhatsApp marca el aviso como leído. Son dos hechos distintos.',
  },
  {
    icon: FileText,
    title: 'Certificado PDF',
    description: 'Lo emitís una sola vez, como una foto. Lo que pase después (otra lectura, un rebote) no entra en ese archivo. Podés volver a bajar la misma copia.',
  },
];

const useCases = [
    "Intimaciones de pago entre particulares o empresas",
    "Reclamos y notificaciones de consumidores hacia empresas proveedoras",
    "Comunicaciones laborales entre empleadores y trabajadores",
    "Avisos de rescisión, incumplimiento o mora contractual",
    "Notificaciones en el marco de relaciones comerciales",
    "Avisos de corte o suspensión de servicios",
    "Comunicaciones en procesos de mediación o instancias previas",
    "Notificaciones de acciones colectivas",
    "Avisos de vencimiento",
    "Gestión de mora",
    "Comunicaciones contractuales",
    "Avisos relacionados con cuentas de clientes",
    "Comunicaciones administrativas",
    "Notificaciones a grandes bases de clientes",
];

const corporateCapabilities = [
  { icon: MessageCircle, title: 'WhatsApp', description: 'Comunicaciones empresariales mediante WhatsApp Business Platform.' },
  { icon: Mail, title: 'Email', description: 'Notificaciones por correo con seguimiento de estados disponibles.' },
  { icon: Users, title: 'Personalización', description: 'Adaptamos cada comunicación con los datos de cada destinatario.' },
  { icon: Link2, title: 'Trazabilidad', description: 'Seguimiento individual de cada envío y de sus eventos.' },
  { icon: ShieldCheck, title: 'Blockchain', description: 'Certificación tecnológica y registro de evidencia en Polygon.' },
  { icon: FileText, title: 'Reportes', description: 'Constancias digitales y reportes de la campaña ejecutada.' },
];

export default function LandingPage() {
  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={serviceJsonLd()} />
      <JsonLd data={faqPageJsonLd()} />
      <LandingHeader />

      <main className="flex-1">
        <section className="landing-hero px-4 py-16 sm:py-20 md:py-24">
          <div className="container grid items-start gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
            <div className="landing-hero-copy max-w-2xl">
              <h1 className="mb-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-tight">
                Notificas: notificaciones digitales con constancia de envío y lectura
              </h1>
              <p className="landing-hero-muted mb-8 max-w-[65ch] text-pretty text-base leading-relaxed sm:text-lg">
                Notificá por WhatsApp o correo y obtené un rastro comprobable. Más rápido y económico que una carta documento, con PDF para tu expediente.
              </p>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/signup">Empezá Ahora</Link>
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

            <ol className="landing-hero-proof border-l border-white/20 pl-5 sm:pl-6">
              {certifiedEvents.map((event) => (
                <li key={event.title} className="relative pb-5 last:pb-0">
                  <event.icon
                    className="absolute -left-[1.85rem] top-0.5 h-4 w-4 text-white sm:-left-[2.05rem]"
                    aria-hidden
                  />
                  <p className="font-semibold leading-snug text-white">{event.title}</p>
                  <p className="landing-hero-muted mt-1 max-w-[60ch] text-sm leading-relaxed">
                    {event.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="blockchain" className="px-4 py-16 sm:py-20 md:py-24">
            <div className="container">
                <div className="max-w-3xl space-y-10">
                    <div>
                        <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">¿Qué es la tecnología blockchain?</h2>
                        <p className="mb-0 max-w-[70ch] leading-relaxed text-muted-foreground">
                            Blockchain —o cadena de bloques enlazados y cifrados— es una base de datos distribuida diseñada para que la información, una vez registrada, no pueda ser modificada ni eliminada. Cada bloque contiene un sello de tiempo y una referencia criptográfica al bloque anterior, formando una cadena inmutable y auditable por cualquier persona.
                        </p>
                    </div>

                    <div>
                        <h3 className="mb-3 text-xl font-semibold">La red que usamos: Polygon</h3>
                        <p className="mb-4 max-w-[70ch] leading-relaxed text-muted-foreground">
                            Notificas utiliza <strong className="font-semibold text-foreground">Polygon</strong>, una blockchain pública compatible con Ethereum, con miles de nodos distribuidos alrededor del mundo y más de mil millones de transacciones procesadas. Es una de las redes más auditadas y utilizadas a nivel global, con consenso Proof of Stake y costos de transacción muy bajos.
                        </p>
                        <p className="max-w-[70ch] leading-relaxed text-muted-foreground">
                            Cada transacción generada por Notificas es verificable de forma independiente en{' '}
                            <a href="https://polygonscan.com" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">polygonscan.com</a>
                            {' '}ingresando el hash de la transacción. Nadie —ni Notificas ni nadie más— puede alterar ese registro una vez confirmado.
                        </p>
                    </div>

                    <Button variant="link" className="h-auto px-0" asChild>
                        <a href="https://polygon.technology" target="_blank" rel="noopener noreferrer">Más sobre Polygon <ArrowRight className="ml-2 h-4 w-4" /></a>
                    </Button>
                </div>
            </div>
        </section>
        
        <section id="ventajas" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <h2 className="mb-10 max-w-3xl text-3xl font-bold tracking-tight md:mb-14 md:text-4xl">
              Conocé las ventajas de nuestro servicio
            </h2>
            <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
              {features.map((feature) => (
                <article key={feature.title} className="max-w-[60ch]">
                  <h3 className="flex items-start gap-3 text-lg font-semibold leading-snug">
                    <feature.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    {feature.title}
                  </h3>
                  <p className="mt-2 pl-8 leading-relaxed text-muted-foreground">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-band px-4 py-12 md:py-16">
          <div className="container flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Notificaciones a escala</h2>
              <p className="mt-3 max-w-[65ch] leading-relaxed text-muted-foreground">
                Procesá cientos o miles de comunicaciones mediante WhatsApp o Email con seguimiento individual, trazabilidad y certificación blockchain.
              </p>
            </div>
            <Button className="w-full shrink-0 sm:w-auto" asChild>
              <Link href="/#cotizacion">Solicitar cotización</Link>
            </Button>
          </div>
        </section>

        <section id="empresas" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <div className="mb-10 max-w-3xl md:mb-14">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Soluciones para empresas</h2>
              <p className="mb-6 text-lg text-muted-foreground md:text-xl">
                Notificaciones digitales de alto volumen
              </p>
              <p className="mb-4 max-w-[70ch] leading-relaxed text-muted-foreground">
                Notificas ofrece soluciones para empresas y organizaciones que necesitan realizar cientos o miles de notificaciones mediante WhatsApp o Email, manteniendo trazabilidad individual de cada comunicación.
              </p>
              <p className="mb-4 max-w-[70ch] leading-relaxed text-muted-foreground">
                Gestionamos el procesamiento de bases de destinatarios, personalización de comunicaciones, envío progresivo, seguimiento de estados, registro de eventos, certificación tecnológica mediante blockchain y generación de reportes.
              </p>
              <p className="max-w-[70ch] font-medium leading-relaxed text-foreground">
                Las campañas corporativas y los servicios de alto volumen se implementan previa evaluación técnica y cotización personalizada.
              </p>
            </div>
            <div className="mb-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 md:mb-12">
              {corporateCapabilities.map((item) => (
                <article key={item.title} className="max-w-[42ch]">
                  <h3 className="flex items-center gap-2.5 text-base font-semibold">
                    <item.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
            <p className="mb-10 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              WhatsApp Business Platform permite realizar comunicaciones empresariales mediante plantillas previamente aprobadas cuando corresponda. Notificas permite procesar, enviar, registrar y certificar comunicaciones digitales a escala.
            </p>
            <Card id="cotizacion" className="max-w-xl scroll-mt-24 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl">Solicitar cotización</CardTitle>
                <p className="pt-1 text-sm text-muted-foreground">
                  Contanos el volumen de notificaciones, canal y características de la comunicación.
                </p>
              </CardHeader>
              <CardContent>
                <QuoteContactForm />
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="casos-de-uso" className="px-4 py-16 sm:py-20 md:py-24">
            <div className="container">
                <div className="max-w-4xl">
                    <h2 className="mb-8 text-3xl font-bold tracking-tight md:text-4xl">Casos de uso</h2>
                    <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                        {useCases.map((useCase) => (
                             <li key={useCase} className="flex items-start">
                                <CheckCircle className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden />
                                <span className="leading-relaxed">{useCase}</span>
                            </li>
                        ))}
                    </ul>
                    
                    <div className="mt-14 max-w-xl border-t border-border pt-10">
                        <h3 className="mb-3 flex items-center gap-2 text-xl font-semibold text-foreground">
                            <Search className="h-5 w-5 text-primary" aria-hidden />
                            ¿Necesitas verificar un documento?
                        </h3>
                        <p className="mb-5 max-w-[60ch] text-muted-foreground">
                            Verificá la autenticidad de cualquier constancia PDF emitida por Notificas
                        </p>
                        <Button asChild size="lg">
                            <Link href="/verify">
                                Verificar Documento
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>

        <section id="guias" className="px-4 pb-16 sm:pb-20">
          <div className="container max-w-4xl">
            <h2 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">Guías</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {SEO_GUIDE_PAGES.map((guide) => (
                <li key={guide.path}>
                  <Link
                    href={guide.path}
                    className="block rounded-lg border border-border bg-background/60 p-4 transition-colors hover:bg-muted/60"
                  >
                    <span className="font-semibold leading-snug">{guide.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{guide.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <FaqSection />
      </main>

      <footer className="bg-foreground text-background">
        <div className="container grid grid-cols-1 gap-10 px-4 py-12 md:grid-cols-3 md:gap-8 md:px-6 md:py-14">
            <div>
                <h3 className="mb-4 text-lg font-bold">Notificas</h3>
                <p className="text-sm text-background/80">Colon 12, primer piso - San Nicolás de los Arroyos</p>
                <p className="text-sm text-background/80">Buenos Aires - Argentina</p>
                <div className="mt-5 space-y-2 text-sm">
                    <Link href="/notificacion-fehaciente-digital" className="block text-background/80 underline-offset-4 hover:text-background hover:underline">Notificación fehaciente digital</Link>
                    <Link href="/carta-documento-digital" className="block text-background/80 underline-offset-4 hover:text-background hover:underline">Carta documento digital</Link>
                    <Link href="/notificaciones-whatsapp-empresas" className="block text-background/80 underline-offset-4 hover:text-background hover:underline">WhatsApp para empresas</Link>
                    <Link href="/como-verificar-certificado" className="block text-background/80 underline-offset-4 hover:text-background hover:underline">Cómo verificar un certificado</Link>
                    <Link href="/consumidores" className="block text-background/80 underline-offset-4 hover:text-background hover:underline">Defensa del Consumidor</Link>
                    <Link href="/terminos" className="block text-background/80 underline-offset-4 hover:text-background hover:underline">Términos y Condiciones</Link>
                    <Link href="/privacidad" className="block text-background/80 underline-offset-4 hover:text-background hover:underline">Política de Privacidad</Link>
                    <Link href="/arrepentimiento" className="block text-background/80 underline-offset-4 hover:text-background hover:underline">Derecho de Arrepentimiento</Link>
                </div>
            </div>
            <div id="contacto" className="scroll-mt-24">
                <h3 className="mb-4 text-lg font-bold">Contáctenos</h3>
                <FooterContactForm />
            </div>
             <div>
                <h3 className="mb-4 text-lg font-bold">Contacto Directo</h3>
                <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-background/80">
                        <Mail className="h-4 w-4" aria-hidden />
                        <span>contacto@notificas.com</span>
                    </p>
                    <p className="flex items-center gap-2 text-background/80">
                        <Phone className="h-4 w-4" aria-hidden />
                        <span>+54 93364645357</span>
                    </p>
                </div>
            </div>
        </div>
        <div className="border-t border-background/20">
            <div className="container space-y-2 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-background/80 md:px-6">
                <p>Copyright © 2026 | Notificas SRL</p>
                <p>
                  <Link
                    href="/login?next=/empresa"
                    className="text-xs leading-tight text-background/55 transition-colors hover:text-background/80"
                  >
                    Acceso empresas
                  </Link>
                </p>
            </div>
        </div>
      </footer>
    </div>
  );
}

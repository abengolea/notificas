import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, Cpu, ArrowRight, Mail, Send, Phone, Search } from 'lucide-react';
import { FaqSection } from '@/components/faq-section';
import { FooterContactForm } from '@/components/footer-contact-form';
import { LandingHeader } from '@/components/landing-header';
import { JsonLd } from '@/components/json-ld';
import { createPageMetadata } from '@/lib/seo';
import {
  faqPageJsonLd,
  organizationJsonLd,
  serviceJsonLd,
  websiteJsonLd,
} from '@/lib/structured-data';

const HOME_TITLE =
  'Notificas | Notificaciones fehacientes digitales certificadas en blockchain';
const HOME_DESCRIPTION =
  'Enviá notificaciones fehacientes digitales con valor probatorio. Certificá envío, recepción y lectura en Polygon. Alternativa digital a la carta documento en Argentina.';

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
    ],
  }),
  title: { absolute: HOME_TITLE },
};

const features = [
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: 'COMUNICACIONES CERTIFICADAS',
    description: 'Tus comunicaciones son registradas y certificadas de manera inmutable en la red Polygon (blockchain pública y descentralizada).',
  },
  {
    icon: <Send className="h-10 w-10 text-primary" />,
    title: 'ENVÍOS',
    description: 'La preparación y el envío son instantáneos.',
  },
  {
    icon: <Cpu className="h-10 w-10 text-primary" />,
    title: 'COSTOS',
    description: 'Hasta 20 veces más económico que una carta documento, con mayor trazabilidad y sin necesidad de concurrir a ninguna oficina.',
  },
  {
    icon: <ArrowRight className="h-10 w-10 text-primary" />,
    title: 'TRAZABILIDAD COMPLETA',
    description: 'Cada evento queda registrado: envío, recepción, apertura y lectura confirmada, tanto por correo como por WhatsApp. Todo certificado en Polygon y verificable de forma independiente.',
  },
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: 'PRUEBA EN JUICIO',
    description: 'El sistema genera un certificado oficial con valor probatorio para demostrar el envío, contenido, recepción y/o lectura del mensaje.',
  },
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: 'ALMACENAMIENTO',
    description: 'La documentación queda guardada por más de 5 años.',
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
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={serviceJsonLd()} />
      <JsonLd data={faqPageJsonLd()} />
      <LandingHeader />

      <main className="flex-1">
        <section className="bg-muted/20 px-4 py-14 sm:py-20 md:py-32">
          <div className="container text-center">
            <h1 className="mb-6 text-balance text-3xl font-bold tracking-tighter sm:text-4xl md:text-6xl">
              Notificas: notificaciones fehacientes digitales con respaldo blockchain
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-pretty text-base text-muted-foreground sm:text-lg md:text-xl">
              El contenido, envío, recepción y lectura de cada comunicación quedan registrados de forma inmutable en blockchain. Usamos la red Polygon: pública, descentralizada y verificable por cualquier persona.
            </p>
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/signup">Empezá Ahora</Link>
            </Button>
          </div>
        </section>

        <section id="blockchain" className="px-4 py-16 sm:py-20 md:py-28">
            <div className="container flex justify-center">
                <div className="max-w-3xl text-center md:text-left space-y-8">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">¿QUÉ ES LA TECNOLOGÍA BLOCKCHAIN?</h2>
                        <p className="text-muted-foreground mb-4 leading-relaxed">
                            Blockchain —o cadena de bloques enlazados y cifrados— es una base de datos distribuida diseñada para que la información, una vez registrada, no pueda ser modificada ni eliminada. Cada bloque contiene un sello de tiempo y una referencia criptográfica al bloque anterior, formando una cadena inmutable y auditable por cualquier persona.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold mb-3">La red que usamos: Polygon</h3>
                        <p className="text-muted-foreground mb-4 leading-relaxed">
                            Notificas utiliza <strong>Polygon</strong>, una blockchain pública compatible con Ethereum, con miles de nodos distribuidos alrededor del mundo y más de mil millones de transacciones procesadas. Es una de las redes más auditadas y utilizadas a nivel global, con consenso Proof of Stake y costos de transacción muy bajos.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            Cada transacción generada por Notificas es verificable de forma independiente en{' '}
                            <a href="https://polygonscan.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">polygonscan.com</a>
                            {' '}ingresando el hash de la transacción. Nadie —ni Notificas ni nadie más— puede alterar ese registro una vez confirmado.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold mb-4">¿Qué eventos se certifican en blockchain?</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Card className="text-left">
                                <CardContent className="pt-5 pb-4">
                                    <p className="font-semibold text-foreground mb-1">📤 Envío</p>
                                    <p className="text-sm text-muted-foreground">Marca de tiempo del envío, hash SHA-256 del contenido (asunto + cuerpo) e ID del servidor SMTP. Prueba qué se envió, a quién y cuándo.</p>
                                </CardContent>
                            </Card>
                            <Card className="text-left">
                                <CardContent className="pt-5 pb-4">
                                    <p className="font-semibold text-foreground mb-1">📱 Notificación por WhatsApp</p>
                                    <p className="text-sm text-muted-foreground">El aviso por WhatsApp también queda registrado: envío del mensaje, acceso al enlace y apertura del contenido, todo en el audit trail certificado.</p>
                                </CardContent>
                            </Card>
                            <Card className="text-left">
                                <CardContent className="pt-5 pb-4">
                                    <p className="font-semibold text-foreground mb-1">📨 Recepción</p>
                                    <p className="text-sm text-muted-foreground">Primer acceso fehaciente al mensaje por el destinatario —ya sea por correo o WhatsApp—, encadenado criptográficamente al evento de envío.</p>
                                </CardContent>
                            </Card>
                            <Card className="text-left">
                                <CardContent className="pt-5 pb-4">
                                    <p className="font-semibold text-foreground mb-1">✅ Lectura confirmada</p>
                                    <p className="text-sm text-muted-foreground">Confirmación explícita de lectura por parte del destinatario. El evento más sólido probatoriamente, vinculado a todos los eventos anteriores.</p>
                                </CardContent>
                            </Card>
                            <Card className="text-left sm:col-span-2">
                                <CardContent className="pt-5 pb-4">
                                    <p className="font-semibold text-foreground mb-1">📄 Certificado PDF</p>
                                    <p className="text-sm text-muted-foreground">Hash SHA-256 del PDF oficial generado, anclado en blockchain y encadenado al envío. Garantiza que el certificado presentado ante un juez no fue alterado.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <Button variant="link" className="px-0" asChild>
                        <a href="https://polygon.technology" target="_blank" rel="noopener noreferrer">Más sobre Polygon <ArrowRight className="ml-2 h-4 w-4" /></a>
                    </Button>
                </div>
            </div>
        </section>
        
        <section id="ventajas" className="bg-muted/20 px-4 py-16 sm:py-20 md:py-28">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">CONOCÉ LAS VENTAJAS DE NUESTRO SERVICIO</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="text-center">
                  <CardHeader>
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                        {feature.icon}
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="casos-de-uso" className="px-4 py-16 sm:py-20 md:py-28">
            <div className="container flex justify-center">
                <div className="max-w-3xl">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center md:text-left">CASOS DE USO</h2>
                    <ul className="space-y-3">
                        {useCases.map((useCase, index) => (
                             <li key={index} className="flex items-start">
                                <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                                <span>{useCase}</span>
                            </li>
                        ))}
                    </ul>
                    
                    {/* Link de Verificación */}
                    <div className="mt-12 text-center">
                        <div className="bg-muted/30 p-6 rounded-lg border border-border">
                            <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center justify-center gap-2">
                                <Search className="h-5 w-5 text-primary" aria-hidden />
                                ¿Necesitas verificar un documento?
                            </h3>
                            <p className="text-muted-foreground mb-4">
                                Verifica la autenticidad de cualquier constancia PDF emitida por Notificas.com
                            </p>
                            <Button asChild size="lg">
                                <Link href="/verify">
                                    Verificar Documento
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <FaqSection />
      </main>

      <footer className="bg-foreground text-background">
        <div className="container grid grid-cols-1 gap-8 px-4 py-10 md:grid-cols-3 md:py-12 md:px-6">
            <div>
                <h3 className="font-bold text-lg mb-4">Notificas</h3>
                <p className="text-sm text-background/80">Colon 12, primer piso - San Nicolás de los Arroyos</p>
                <p className="text-sm text-background/80">Buenos Aires - Argentina</p>
                <div className="mt-4 space-y-2 text-sm">
                    <Link href="/consumidores" className="block hover:underline text-background/80 hover:text-background">Defensa del Consumidor</Link>
                    <Link href="/terminos" className="block hover:underline text-background/80 hover:text-background">Términos y Condiciones</Link>
                    <Link href="/privacidad" className="block hover:underline text-background/80 hover:text-background">Política de Privacidad</Link>
                    <Link href="/arrepentimiento" className="block hover:underline text-background/80 hover:text-background">Derecho de Arrepentimiento</Link>
                </div>
            </div>
            <div>
                <h3 className="font-bold text-lg mb-4">Contáctenos</h3>
                <FooterContactForm />
            </div>
             <div>
                <h3 className="font-bold text-lg mb-4">Contacto Directo</h3>
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
            <div className="container px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-background/80 space-y-2 md:px-6">
                <p>Copyright © 2026 | Notificas SRL</p>
                <p>
                  <Link
                    href="/login?next=/empresa"
                    className="text-[10px] leading-tight text-background/45 hover:text-background/65 transition-colors"
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

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, Cpu, ArrowRight, Mail, Send, Phone, Search } from 'lucide-react';
import { FaqSection } from '@/components/faq-section';
import { FooterContactForm } from '@/components/footer-contact-form';
import { LandingHeader } from '@/components/landing-header';

const features = [
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: 'COMUNICACIONES CERTIFICADAS',
    description: 'Tus comunicaciones son registradas y certificadas de manera inmutable en la blockchain.',
  },
  {
    icon: <Send className="h-10 w-10 text-primary" />,
    title: 'ENVÍOS',
    description: 'La preparación y el envío son instantáneos.',
  },
  {
    icon: <Cpu className="h-10 w-10 text-primary" />,
    title: 'COSTOS',
    description: 'Los costos son menores en comparación con las cartas documento.',
  },
  {
    icon: <ArrowRight className="h-10 w-10 text-primary" />,
    title: 'REENVIOS',
    description: 'Si el destinatario no abre el correo, nuestro sistema vuelve a enviar otro de manera automática quedando todo registrado en la blockchain.',
  },
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: 'PLANTILLAS',
    description: 'Podés usar modelos/plantillas de intimaciones.',
  },
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: 'PRUEBA EN JUICIO',
    description: 'El sistema genera una pericia informática automática para que puedas demostrar en juicio el envío, contenido, recepción y/o lectura del mensaje.',
  },
   {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: 'ALMACENAMIENTO',
    description: 'La documentación queda guardada por más de 5 años.',
  },
];

const useCases = [
    "Diligenciamiento de oficios electrónicos",
    "Intimaciones o reclamos de consumidores hacia empresas proveedoras",
    "Intimaciones de pago",
    "Comunicaciones entre empleados y trabajadores",
    "Intimaciones entre particulares (reclamo de pago, daños, deudas, etc.)",
    "Notificaciones de actos administrativos",
    "Reclamos de consumidores",
    "Comunicaciones laborales",
    "Avisos de corte de servicios",
    "Notificaciones de acciones colectivas",
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <LandingHeader />

      <main className="flex-1">
        <section className="bg-muted/20 px-4 py-14 sm:py-20 md:py-32">
          <div className="container text-center">
            <h1 className="mb-6 text-balance text-3xl font-bold tracking-tighter sm:text-4xl md:text-6xl">
              Comunicaciones fehacientes, con respaldo blockchain.
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-pretty text-base text-muted-foreground sm:text-lg md:text-xl">
              El contenido, envío, recepción y lectura de la comunicación quedará registrado de forma inmutable en blockchain.
            </p>
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/signup">Empezá Ahora</Link>
            </Button>
          </div>
        </section>

        <section id="blockchain" className="px-4 py-16 sm:py-20 md:py-28">
            <div className="container flex justify-center">
                <div className="max-w-3xl text-center md:text-left">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">¿QUÉ ES LA TECNOLOGÍA BLOCKCHAIN?</h2>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                        Blockchain -o cadena de bloques enlazados y cifrados- es un tipo de tecnología digital que funciona como una base de datos diseñada para evitar ser modificada una vez que la información se publica o envía.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                        La información se enlaza al bloque anterior de forma cronológica, descentralizada, distribuida y auditable, asegurando su autenticidad, seguridad y estándares éticos.
                    </p>
                    <Button variant="link" className="px-0 mt-2">Leer más <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
            </div>
        </section>
        
        <section id="ventajas" className="bg-muted/20 px-4 py-16 sm:py-20 md:py-28">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">CONOCÉ LAS VENTAJAS DE NUESTRO SERVICIO</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.slice(0, 6).map((feature, index) => (
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
                <h3 className="font-bold text-lg mb-4">MegaOne</h3>
                <p className="text-sm text-background/80">Colon 12, primer piso - San Nicolás de los Arroyos</p>
                <p className="text-sm text-background/80">Buenos Aires - Argentina</p>
                <div className="mt-4 space-y-2 text-sm">
                    <Link href="#" className="block hover:underline text-background/80 hover:text-background">Defensa de las y los consumidores (Hacé el reclamo aquí)</Link>
                    <Link href="#" className="block hover:underline text-background/80 hover:text-background">Términos y Condiciones (click aquí)</Link>
                    <Link href="#" className="block hover:underline text-background/80 hover:text-background">Política de privacidad (click aquí)</Link>
                    <Link href="#" className="block hover:underline text-background/80 hover:text-background">Derecho de arrepentimiento</Link>
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
                <p>Copyright © 2019-2025 | Desarrollado por Notificas SRL</p>
                <p>
                  <Link
                    href="/login?next=/empresa"
                    className="text-[10px] leading-tight text-background/45 hover:text-background/65 transition-colors"
                  >
                    Acceso empresas
                  </Link>
                </p>
                <Link href="/admin" className="text-xs hover:underline inline-block">Admin Panel</Link>
            </div>
        </div>
      </footer>
    </div>
  );
}

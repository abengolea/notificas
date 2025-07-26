import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, ShieldCheck, Cpu, ArrowRight, Mail, Building, Send, Phone } from 'lucide-react';
import Image from 'next/image';

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
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-10 w-auto" />
            <span className="font-bold text-xl">Notificas</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="#ventajas" className="text-muted-foreground transition-colors hover:text-foreground">Ventajas</Link>
            <Link href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">Preguntas frecuentes</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Registrate</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 md:py-32 bg-muted/20">
          <div className="container text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6">Comunicaciones fehacientes, con respaldo blockchain.</h1>
            <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-8">
              El contenido, envío, recepción y lectura de la comunicación quedará registrado de forma inmutable en blockchain.
            </p>
            <Button size="lg" asChild>
              <Link href="/signup">Empezá Ahora</Link>
            </Button>
          </div>
        </section>

        <section id="blockchain" className="py-20 md:py-28">
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
        
        <section id="ventajas" className="py-20 md:py-28 bg-muted/20">
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

        <section id="casos-de-uso" className="py-20 md:py-28">
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
                </div>
            </div>
        </section>

        <section id="faq" className="py-20 md:py-28 bg-muted/20">
            <div className="container text-center">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Resolvé tus dudas leyendo nuestras preguntas frecuentes</h2>
                <Button>Preguntas frecuentes</Button>
            </div>
        </section>
      </main>

      <footer className="bg-foreground text-background">
        <div className="container py-12 grid md:grid-cols-3 gap-8">
            <div>
                <h3 className="font-bold text-lg mb-4">MegaOne</h3>
                <p className="text-sm text-muted-foreground">Colon 12, primer piso - San Nicolás de los Arroyos</p>
                <p className="text-sm text-muted-foreground">Buenos Aires - Argentina</p>
                <div className="mt-4 space-y-2 text-sm">
                    <Link href="#" className="block hover:underline text-muted-foreground">Defensa de las y los consumidores (Hacé el reclamo aquí)</Link>
                    <Link href="#" className="block hover:underline text-muted-foreground">Terminos y Condiciones (click aquí)</Link>
                    <Link href="#" className="block hover:underline text-muted-foreground">Politica de privacidad (click aquí)</Link>
                    <Link href="#" className="block hover:underline text-muted-foreground">Derecho de arrepentimiento</Link>
                </div>
            </div>
            <div>
                <h3 className="font-bold text-lg mb-4">Contáctenos</h3>
                 <div className="space-y-4">
                    <Input placeholder="Nombre" className="bg-background/20 border-border/50 text-foreground" />
                    <Input placeholder="Compañía" className="bg-background/20 border-border/50 text-foreground" />
                    <Input type="email" placeholder="Email" className="bg-background/20 border-border/50 text-foreground" />
                    <Button asChild className="w-full">
                      <a href="mailto:contacto@notificas.com">Enviar</a>
                    </Button>
                </div>
            </div>
             <div>
                <h3 className="font-bold text-lg mb-4">Contacto Directo</h3>
                <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4"/>
                        <span>contacto@notificas.com</span>
                    </p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4"/>
                        <span>+54 93364645357</span>
                    </p>
                </div>
            </div>
        </div>
        <div className="border-t border-border/20">
            <div className="container py-4 text-center text-sm text-muted-foreground">
                <p>Copyright © 2019-2025 | Desarrollado por Alberione Soluciones Integrales</p>
                <Link href="/admin" className="text-xs hover:underline mt-2 inline-block">Admin Panel</Link>
            </div>
        </div>
      </footer>
    </div>
  );
}

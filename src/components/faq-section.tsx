"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { LEGACY_ARCHIVO_LOGIN_HREF } from "@/lib/legacy-archivo";
import { RESOURCE_HUB } from "@/lib/public-resources";

type FaqItem = {
  question: string;
  answer: ReactNode;
  more?: { href: string; label: string };
};

const faqItems: FaqItem[] = [
  {
    question: "¿Qué es Notificas?",
    answer:
      "Una plataforma para enviar un mensaje y dejar constancia de qué se envió, a quién y cuándo. La huella queda en Polygon; el expediente (texto, destinos, eventos) se conserva en Notificas.",
    more: {
      href: "/notificacion-fehaciente-digital",
      label: "Qué se registra y qué no",
    },
  },
  {
    question: "¿Qué eventos se certifican en blockchain?",
    answer:
      "En la red pública no subimos el archivo entero: subimos huellas. Queda el envío, lo que Meta informa de WhatsApp, el primer click al enlace si ocurre, la lectura si la hay, y la huella del PDF.",
    more: {
      href: "/como-verificar-certificado",
      label: "Cómo se comprueba esa huella",
    },
  },
  {
    question: "¿Qué pasa con el canal de WhatsApp?",
    answer:
      "Viaja la plantilla que Meta ya aprobó, con los datos de esa persona. No es la carta completa, salvo que la plantilla sea ese texto. Meta nos dice si llegó al celular o si lo abrieron.",
    more: {
      href: "/notificacion-whatsapp",
      label: "Notificar por WhatsApp",
    },
  },
  {
    question: "¿Equivale a una carta documento?",
    answer:
      "No. Es más rápido y más barato, y deja un rastro comprobable. Si una norma pide carta documento u otra forma puntual, hay que usar esa forma. Un juez decide qué valor le da a esta constancia.",
    more: {
      href: "/notificacion-digital-vs-carta-documento",
      label: "Diferencia con la carta documento",
    },
  },
  {
    question: "¿Qué pasa si el destinatario no abre el correo?",
    answer:
      "Queda que nuestro servidor aceptó enviarlo. Eso no prueba que haya llegado a la bandeja ni que lo hayan leído. Si rebotó, lo anotamos. Si también mandás WhatsApp, se suma lo que Meta reporte.",
    more: {
      href: "/email-certificado",
      label: "Evidencia de un correo",
    },
  },
  {
    question: "¿Por cuánto tiempo se conserva la documentación?",
    answer:
      "Adjuntos, PDFs y el texto sellado se guardan 5 años y no se borran a pedido en ese plazo. Lo que quedó en Polygon no se borra nunca.",
  },
  {
    question: "¿Cómo se usa el certificado en un juicio o reclamo?",
    answer:
      "La constancia de envío se genera sola. El certificado de lectura lo emitís una sola vez, como una foto de ese instante. Después podés bajar la misma copia; no se le agregan hechos nuevos. Quien juzga decide si le sirve.",
    more: {
      href: "/whatsapp-como-prueba",
      label: "Qué evidencia conviene conservar",
    },
  },
  {
    question: "¿Cómo verifico que un certificado es auténtico?",
    answer: (
      <>
        En{" "}
        <Link
          href="/verify"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Verificar certificado
        </Link>{" "}
        subí el PDF o ingresá el ID. Comparamos la huella del archivo con la que quedó en Polygon.
      </>
    ),
    more: {
      href: "/como-verificar-certificado",
      label: "Paso a paso para verificar",
    },
  },
  {
    question: "¿Cómo empiezo a usar Notificas?",
    answer: (
      <>
        Creá tu cuenta en{" "}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Registro
        </Link>
        . Desde el panel cargás créditos y enviás. Para volumen, usá el{" "}
        <Link
          href="/login?next=/empresa"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          acceso empresas
        </Link>
        .
      </>
    ),
  },
  {
    question: "¿Notificas ofrece notificaciones de alto volumen para empresas?",
    answer:
      "Sí. Además de envíos uno a uno, hay campañas para cientos o miles de destinatarios por WhatsApp o correo, con seguimiento por fila. Se cotizan caso por caso.",
    more: {
      href: "/notificaciones-masivas-empresas",
      label: "Notificaciones masivas para empresas",
    },
  },
  {
    question: "¿Cómo funcionan las campañas corporativas por WhatsApp y Email?",
    answer:
      "WhatsApp usa plantillas que Meta tiene que haber aprobado. En el correo anotamos si nuestro servidor lo aceptó, si rebotó, y si la persona abrió el enlace de lectura. No publicamos tarifas de Meta.",
    more: {
      href: "/notificaciones-whatsapp-empresas",
      label: "WhatsApp para empresas",
    },
  },
  {
    question: "Usaba notificas.com, ¿dónde están mis envíos anteriores?",
    answer: (
      <>
        Los envíos de la plataforma anterior se consultan en el{" "}
        <a
          href={LEGACY_ARCHIVO_LOGIN_HREF}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          archivo histórico
        </a>
        . Los envíos nuevos se hacen en esta web. Si tu usuario fue migrado,{" "}
        <Link
          href="/cuenta/activar-migracion"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          activá tu cuenta
        </Link>
        .
      </>
    ),
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 px-4 pt-24 pb-16 sm:pt-28 sm:pb-20 md:pt-28 md:pb-24">
      <div className="container">
        <div className="mb-8 md:mb-10">
          <h2 className="section-title mb-3">
            Preguntas frecuentes
          </h2>
          <p className="max-w-[65ch] text-base leading-relaxed text-muted-foreground md:text-lg">
            Lo esencial acá. El detalle está en cada guía.
          </p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger className="py-4 text-left text-sm hover:no-underline data-[state=open]:underline sm:text-base">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pt-0">
                <div className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground md:text-base">
                  {item.answer}
                  {item.more ? (
                    <p className="mt-3">
                      <Link
                        href={item.more.href}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {item.more.label}
                      </Link>
                    </p>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-8 text-sm leading-relaxed">
          <Link
            href={RESOURCE_HUB.path}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver todas las guías
          </Link>
        </p>
      </div>
    </section>
  );
}

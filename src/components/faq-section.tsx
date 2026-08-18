"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { FAQ_CLAIMS } from "@/lib/honest-claims";

type FaqItem = {
  question: string;
  /** Texto completo (desktop / tablet) */
  answer: ReactNode;
  /** Versión breve en móvil; si falta, se muestra `answer` en todos los tamaños */
  answerShort?: ReactNode;
};

const linkVerify = (
  <Link
    href="/verify"
    className="text-primary font-medium underline-offset-4 hover:underline"
  >
    Verificar certificado
  </Link>
);

const linkSignup = (
  <Link
    href="/signup"
    className="text-primary font-medium underline-offset-4 hover:underline"
  >
    Registro
  </Link>
);

const linkEmpresa = (
  <Link
    href="/login?next=/empresa"
    className="text-primary font-medium underline-offset-4 hover:underline"
  >
    acceso empresas
  </Link>
);

const faqItems: FaqItem[] = [
  ...FAQ_CLAIMS.slice(0, 7).map((item) => ({
    question: item.question,
    answer: item.answer,
  })),
  {
    question: FAQ_CLAIMS[7].question,
    answer: (
      <>
        Ingresá a {linkVerify} y subí el PDF o ingresá el ID del mensaje. Comparamos la huella del archivo con la que quedó en Polygon. También podés copiar el código de transacción del PDF y buscarlo en{" "}
        <a href="https://polygonscan.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline-offset-4 hover:underline">polygonscan.com</a>
        .
      </>
    ),
  },
  {
    question: FAQ_CLAIMS[8].question,
    answer: (
      <>
        Creá tu cuenta en {linkSignup}: lleva un par de minutos. Desde el dashboard cargás créditos y enviás. Para volumen, usá el {linkEmpresa}.
      </>
    ),
  },
  {
    question: FAQ_CLAIMS[9].question,
    answer: FAQ_CLAIMS[9].answer,
  },
  {
    question: FAQ_CLAIMS[10].question,
    answer: (
      <>
        WhatsApp usa plantillas que Meta tiene que haber aprobado, con sus reglas y cupos. En el correo anotamos si nuestro servidor lo aceptó, si nos llega un rebote, y si la persona abrió el enlace de lectura. Cada campaña se cotiza; no publicamos tarifas de Meta. Pedí una cotización en{" "}
        <Link
          href="/#cotizacion"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Soluciones para empresas
        </Link>
        .
      </>
    ),
  },
];

function FaqAnswer({ item }: { item: FaqItem }) {
  if (item.answerShort != null) {
    return (
      <>
        <div className="md:hidden text-sm text-muted-foreground leading-relaxed">
          {item.answerShort}
        </div>
        <div className="hidden md:block text-muted-foreground leading-relaxed">
          {item.answer}
        </div>
      </>
    );
  }
  return (
    <div className="text-sm md:text-base text-muted-foreground leading-relaxed">
      {item.answer}
    </div>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="px-4 py-16 sm:py-20 md:py-24">
      <div className="container">
        <div className="mb-8 max-w-3xl md:mb-10">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Preguntas frecuentes
          </h2>
          <p className="max-w-[65ch] text-base leading-relaxed text-muted-foreground md:text-lg">
            Qué queda registrado, qué no, y cómo usar el certificado.
          </p>
        </div>
        <Accordion
          type="single"
          collapsible
          className="w-full max-w-3xl"
        >
          {faqItems.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger className="py-4 text-left text-sm hover:no-underline data-[state=open]:underline sm:text-base">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pt-0">
                <FaqAnswer item={item} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

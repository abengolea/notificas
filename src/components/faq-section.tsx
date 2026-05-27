"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

const linkLogin = (
  <Link
    href="/login"
    className="text-primary font-medium underline-offset-4 hover:underline"
  >
    Iniciar sesión
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
  {
    question: "¿Qué es Notificas?",
    answer:
      "Notificas es una plataforma de notificaciones fehacientes digitales. Cada comunicación que enviás queda certificada en la red Polygon (blockchain pública): el contenido del mensaje, la fecha y hora de envío, la recepción y la lectura del destinatario. Todo queda registrado de forma inmutable y verificable por cualquier persona.",
  },
  {
    question: "¿Qué eventos se certifican en blockchain?",
    answer:
      "Certificamos cuatro eventos en cadena: el envío (con hash SHA-256 del contenido e ID del servidor SMTP), la recepción (primer acceso fehaciente del destinatario), la lectura confirmada (cuando el destinatario confirma explícitamente haber leído), y el certificado PDF (hash del documento oficial, encadenado al envío). Todos los eventos están vinculados entre sí mediante referencias criptográficas.",
  },
  {
    question: "¿Qué pasa con el canal de WhatsApp?",
    answer:
      "Además del correo electrónico, enviamos una notificación por WhatsApp al destinatario. Registramos el envío del mensaje, la entrega al dispositivo, la apertura del enlace y la lectura del contenido. Todos estos eventos también quedan certificados en Polygon.",
  },
  {
    question: "¿Equivale a una carta documento?",
    answer:
      "Es más económico, más rápido y con mayor trazabilidad que una carta documento tradicional — hasta 20 veces más barato, sin necesidad de concurrir a ninguna oficina. El certificado que generamos tiene valor probatorio y puede presentarse ante autoridades judiciales o administrativas. Para casos específicos que exijan una forma legal determinada, consultá con tu asesor legal.",
  },
  {
    question: "¿Qué pasa si el destinatario no abre el correo?",
    answer:
      "Igual queda constancia del envío certificado en Polygon. Si el destinatario no abre el mensaje, el sistema registra el intento de entrega y el estado de la comunicación. Podés también notificar por WhatsApp simultáneamente, lo que amplia la cobertura del intento fehaciente. El certificado PDF refleja todos los eventos ocurridos hasta el momento en que lo descargás.",
  },
  {
    question: "¿Por cuánto tiempo se conserva la documentación?",
    answer:
      "Toda la documentación asociada a tus envíos se conserva por un mínimo de 5 años. Las transacciones en Polygon son permanentes por naturaleza: ningún tercero, ni siquiera Notificas, puede modificarlas o eliminarlas una vez confirmadas.",
  },
  {
    question: "¿Cómo se usa el certificado en un juicio o reclamo?",
    answer:
      "Desde el dashboard podés descargar el certificado PDF oficial de cualquier envío. Ese documento incluye todos los eventos certificados, los hashes SHA-256, los hash de transacción en Polygon y la cadena de eventos. El hash del propio PDF también queda anclado en blockchain, lo que garantiza que no fue alterado. Podés presentarlo directamente en cualquier expediente.",
  },
  {
    question: "¿Cómo verifico que un certificado es auténtico?",
    answer: (
      <>
        Ingresá a la sección {linkVerify} y subí el PDF o ingresá el ID del mensaje. El sistema compara el hash del documento con el registrado en Polygon. Si coincide, el certificado es auténtico y no fue modificado. También podés verificar la transacción de forma independiente en{" "}
        <a href="https://polygonscan.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline-offset-4 hover:underline">polygonscan.com</a>{" "}
        ingresando el hash de TX que figura en el PDF.
      </>
    ),
  },
  {
    question: "¿Cómo empiezo a usar Notificas?",
    answer: (
      <>
        Creá tu cuenta en {linkSignup} — el proceso toma menos de dos minutos. Desde el dashboard podés cargar créditos y empezar a enviar notificaciones certificadas de inmediato. Para cuentas corporativas o de volumen, usá el {linkEmpresa}.
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
    <section id="faq" className="py-16 md:py-28 bg-muted/20">
      <div className="container px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center mb-8 md:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 md:mb-3">
            Preguntas frecuentes
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Todo lo que necesitás saber sobre el servicio, la certificación en blockchain y cómo usar la plataforma.
          </p>
        </div>
        <Accordion
          type="single"
          collapsible
          className="mx-auto max-w-3xl w-full rounded-lg border bg-background px-3 sm:px-5 md:px-6"
        >
          {faqItems.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-sm sm:text-base hover:no-underline data-[state=open]:underline py-4">
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

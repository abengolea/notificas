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
    answerShort:
      "Servicio de constancia digital: registro de contenido, envío, recepción y lectura en blockchain. Aplicable a intimaciones, reclamos, avisos laborales y oficios, entre otros.",
    answer:
      "Notificas es un servicio de comunicaciones con constancia digital mediante tecnología blockchain. Cabe registrar, entre otros aspectos, el contenido del mensaje, el envío, la recepción y/o la lectura. La solución está orientada a supuestos como intimaciones, reclamos de consumo, relaciones laborales, oficios electrónicos y, en general, comunicaciones en las que se requiera trazabilidad documentada. La viabilidad jurídica en cada supuesto depende del acto y de la normativa aplicable.",
  },
  {
    question: "¿Qué aporta la blockchain a una comunicación?",
    answerShort:
      "La cadena de bloques deja un registro enlazado y difícil de alterar, útil para acreditar fechas y contenidos. No reemplaza asesoramiento profesional.",
    answer:
      "La información se incorpora a una cadena de bloques enlazada de manera cronológica y auditable. Una vez asentado el registro, resulta sumamente oneroso modificarlo sin dejar evidencia, lo que refuerza la integridad temporal y el soporte para acreditar qué mensaje se envió y en qué momento. La interpretación probatoria en sede administrativa o judicial corresponde a cada caso concreto.",
  },
  {
    question: "¿Equivale a una carta documento u otro acto notarial?",
    answerShort:
      "No automáticamente. Cada instrumento tiene requisitos legales según el acto y la jurisdicción. Notificas ofrece constancia digital; es conveniente consultar a un abogado o escribano.",
    answer:
      "No necesariamente. La carta documento, las notificaciones ante organismo público y otros medios de constancia están regulados de modo específico según el tipo de acto y la jurisdicción. Notificas brinda constancia digital con respaldo técnico (envío, contenido, recepción y/o lectura, y documentación asociada). Para determinar si el instrumento resulta idóneo en un expediente o reclamo determinado, se recomienda consultar a un profesional habilitado. Nada de lo aquí expuesto constituye asesoramiento jurídico.",
  },
  {
    question: "¿Qué ocurre si el destinatario no abre el correo?",
    answerShort:
      "Queda constancia del envío y de la recepción del mensaje por el servidor de correo del destinatario; además, el sistema puede reintentar el envío y dejar registro de ese proceso en blockchain.",
    answer:
      "Aun cuando el destinatario no abra el mensaje, el servicio deja constancia del envío y del acuse o recepción del correo en el servidor del destinatario (entrega en buzón a nivel de infraestructura de correo), según los eventos que capture la plataforma. Si corresponde a la configuración vigente, puede aplicarse el reenvío automatizado y el registro de dichos reintentos y del proceso en la cadena de bloques. La lectura o apertura del mensaje constituye un evento distinto y, cuando se registra, refuerza la trazabilidad. Cantidad de reintentos y plazos dependen de la funcionalidad habilitada en cada momento.",
  },
  {
    question: "¿Por cuánto tiempo se conserva la documentación?",
    answerShort:
      "La documentación asociada puede conservarse, como mínimo, cinco años, según lo informado en este sitio.",
    answer:
      "Según la información publicada en el sitio, la documentación asociada a las comunicaciones puede almacenarse durante un período no inferior a cinco años, a fin de preservar respaldo e historial. Los plazos exactos pueden actualizarse en los términos comerciales o la política aplicable; se sugiere revisar la versión vigente al momento del envío.",
  },
  {
    question: "¿Cómo se acredita el envío o la lectura en un juicio o reclamo?",
    answerShort:
      "Se generan constancias y documentación vinculada a la cadena de eventos. La eficacia probatoria la determina el juez o la autoridad según el caso.",
    answer:
      "El sistema está diseñado para producir documentación de respaldo (constancias, informes o materiales asociados a la secuencia de eventos) que puedan incorporarse a un expediente o reclamo, siempre con el sustento profesional que corresponda. La valoración probatoria es prerrogativa del órgano jurisdiccional o administrativo competente, según el caso y la normativa aplicable.",
  },
  {
    question: "¿Cómo se verifica un PDF o certificado emitido por Notificas?",
    answerShort: (
      <>
        Utilice la sección {linkVerify} para validar constancias atribuidas a Notificas.
      </>
    ),
    answer: (
      <>
        Puede verificar la autenticidad de las constancias en formato PDF atribuidas a Notificas mediante la sección{" "}
        {linkVerify}
        , donde se contrasta el documento con los registros del servicio.
      </>
    ),
  },
  {
    question: "¿Cómo se accede al servicio?",
    answerShort: (
      <>
        {linkSignup}, {linkLogin} o {linkEmpresa} para cuentas corporativas.
      </>
    ),
    answer: (
      <>
        Para crear una cuenta utilice {linkSignup}; para ingresar a una cuenta existente, {linkLogin}. Las organizaciones pueden utilizar el {linkEmpresa} cuando corresponda a su flujo de trabajo.
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
            Información general sobre constancias digitales, blockchain y uso de la
            plataforma. No constituye asesoramiento jurídico.
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

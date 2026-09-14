import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { LandingHeader } from "@/components/landing-header";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";
import {
  BRAZIL_PATH,
  BRAZIL_PRE_NEGATIVACAO_PATH,
  STJ_TEMA_1315_URL,
  brazilBreadcrumbJsonLd,
  brazilOrganizationJsonLd,
  brazilPreNegativacaoMetadata,
  BRAZIL_PRE_NEGATIVACAO_URL,
} from "@/lib/brazil-site";

export const metadata: Metadata = brazilPreNegativacaoMetadata();

const NAV_LINKS = [
  { href: `${BRAZIL_PATH}#evidencias`, label: "Evidências" },
  { href: BRAZIL_PRE_NEGATIVACAO_PATH, label: "Pré-negativação" },
  { href: `${BRAZIL_PATH}#cotacao`, label: "Cotação" },
  { href: "/verify", label: "Verificar" },
];

export default function BrazilPreNegativacaoPage() {
  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd data={brazilOrganizationJsonLd()} />
      <JsonLd
        data={brazilBreadcrumbJsonLd([
          { name: "Notificas Brasil", path: BRAZIL_PATH },
          { name: "Pré-negativação", path: BRAZIL_PRE_NEGATIVACAO_PATH },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Comunicações de pré-negativação com rastreabilidade",
          description:
            "Infraestrutura tecnológica para comunicações prévias relacionadas a cadastros de inadimplência, com evidência de envio e entrega.",
          inLanguage: "pt-BR",
          mainEntityOfPage: BRAZIL_PRE_NEGATIVACAO_URL,
        }}
      />
      <LandingHeader
        homeHref={BRAZIL_PATH}
        navLinks={NAV_LINKS}
        showAuthActions={false}
        primaryAction={{ href: `${BRAZIL_PATH}#cotacao`, label: "Solicitar cotação" }}
        menuLabel="Menu"
        openMenuLabel="Abrir menu"
        themeLabel="Tema: claro, escuro ou sistema"
      />

      <main className="flex-1">
        <section className="landing-hero px-4 py-16 sm:py-20">
          <div className="container max-w-3xl">
            <p className="mb-4 text-sm text-white/80">
              <Link href={BRAZIL_PATH} className="underline-offset-4 hover:underline">
                Notificas Brasil
              </Link>
              {" / "}
              Pré-negativação
            </p>
            <h1 className="hero-title mb-5">
              Notificação eletrônica para pré-negativação, com evidência de entrega
            </h1>
            <p className="landing-hero-muted max-w-[62ch] text-pretty text-[1.0625rem] leading-[1.55]">
              Infraestrutura tecnológica para documentar comunicações prévias por e-mail e
              WhatsApp. A Notificas registra o ciclo técnico da mensagem; cada empresa permanece
              responsável pela sua operação.
            </p>
          </div>
        </section>

        <article className="container max-w-3xl space-y-6 px-4 py-16 text-[0.975rem] leading-relaxed text-foreground/90 sm:text-base sm:leading-relaxed">
          <h2 className="section-title">O que mudou no Tema 1.315</h2>
          <p>
            O art. 43, §2º, do Código de Defesa do Consumidor prevê a comunicação ao consumidor
            sobre a abertura de cadastro não solicitado. A Súmula 359 do STJ atribui ao órgão
            mantenedor do cadastro de proteção ao crédito o dever de notificar o devedor antes da
            inscrição.
          </p>
          <p>
            Em 2026, no Tema Repetitivo 1.315, o STJ reconheceu a validade da comunicação
            eletrônica quando comprovada sua entrega ao destinatário.
          </p>
          <p>
            O Superior Tribunal de Justiça consolidou o entendimento de que a comunicação
            eletrônica prevista no art. 43, §2º, do CDC pode ser válida quando comprovada a
            entrega da notificação ao destinatário.
          </p>
          <p>
            <a
              href={STJ_TEMA_1315_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Ver decisão do STJ
            </a>
          </p>

          <h2 className="section-title pt-6">O que a Notificas documenta</h2>
          <p>
            A Notificas registra os eventos técnicos necessários para documentar o ciclo da
            comunicação: conteúdo, envio, entrega, falhas, tentativas e leitura quando disponível.
          </p>
          <p>
            Enviar não é o mesmo que entregar. O comprovante verificável reúne identificadores
            técnicos, trilha de auditoria, hash e PDF individual para cada destinatário.
          </p>
          <p>
            A plataforma não é autoridade certificadora, não é certificadora ICP-Brasil e não
            cumpre, sozinha, toda obrigação legal de pré-negativação. Ela oferece o registro
            técnico para a empresa documentar a comunicação.
          </p>

          <h2 className="section-title pt-6">Para quem faz sentido</h2>
          <p>
            Operações de cobrança, crédito, varejo com financiamento próprio, telecom, utilities e
            áreas jurídicas que precisam comunicar inadimplência em volume e guardar evidência de
            envio e entrega.
          </p>

          <p className="flex items-start gap-2 pt-2 text-sm text-muted-foreground">
            <Scale className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Texto educativo. Não constitui aconselhamento jurídico.
          </p>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href={`${BRAZIL_PATH}#cotacao`}>Solicitar cotação</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={BRAZIL_PATH}>
                Ver a plataforma
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </article>
      </main>
      <PublicFooter locale="pt-BR" />
    </div>
  );
}

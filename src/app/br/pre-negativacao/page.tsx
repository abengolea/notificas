import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";

import { BrazilHeader } from "@/components/br/brazil-header";
import { JsonLd } from "@/components/json-ld";
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
          headline: "Notificação eletrônica para pré-negativação, com evidência de entrega",
          description:
            "Infraestrutura tecnológica para comunicações prévias relacionadas a cadastros de inadimplência, com evidência de envio e entrega.",
          inLanguage: "pt-BR",
          mainEntityOfPage: BRAZIL_PRE_NEGATIVACAO_URL,
        }}
      />
      <BrazilHeader />

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
          <h2 className="section-title">O que é a comunicação de pré-negativação</h2>
          <p>
            Antes de incluir o nome de um consumidor em cadastro de inadimplência, a operação
            brasileira precisa avisá-lo. Essa comunicação prévia — ligada a birôs e órgãos de
            proteção ao crédito — não é um detalhe operacional: está no Código de Defesa do
            Consumidor e na jurisprudência do Superior Tribunal de Justiça.
          </p>
          <p>
            Na prática, credores, financeiras, varejo com carteira própria, telecom e áreas
            jurídicas precisam enviar o aviso, em volume, e guardar o que aconteceu depois do
            disparo. Mandar um e-mail ou um WhatsApp sem rastro técnico deixa a operação exposta
            exatamente no ponto que o STJ passou a olhar: a entrega.
          </p>

          <h2 className="section-title pt-6">O que mudou no Tema 1.315</h2>
          <p>
            O art. 43, §2º, do Código de Defesa do Consumidor prevê a comunicação ao consumidor
            sobre a abertura de cadastro não solicitado. A Súmula 359 do STJ atribui ao órgão
            mantenedor do cadastro de proteção ao crédito o dever de notificar o devedor antes da
            inscrição.
          </p>
          <p>
            Em 2026, no Tema Repetitivo 1.315, o STJ reconheceu a validade da comunicação
            eletrônica quando comprovada sua entrega ao destinatário. O tribunal consolidou o
            entendimento de que a via eletrônica prevista no CDC pode ser válida — desde que a
            entrega da notificação ao destinatário esteja comprovada.
          </p>
          <p>
            Isso não transforma qualquer disparo em notificação automática. O recado operacional é
            outro: se a empresa comunica por e-mail ou WhatsApp, precisa conseguir mostrar o
            conteúdo, o destinatário, a data e a entrega quando o canal a informa.
          </p>
          <p>
            <a
              href={STJ_TEMA_1315_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Ver decisão do STJ sobre o Tema Repetitivo 1.315
            </a>
          </p>

          <h2 className="section-title pt-6">Enviar não é entregar</h2>
          <p>
            Aceitar um envio no servidor de e-mail ou na plataforma de WhatsApp prova que a
            mensagem saiu. Não prova, por si, que chegou à caixa de entrada ou ao aparelho. A
            leitura, quando existe, é um terceiro fato. A evidência de entrega é o elo que o
            mercado brasileiro passou a exigir com mais clareza depois do Tema 1.315.
          </p>
          <p>
            A Notificas registra cada etapa disponível: criação, envio, aceitação pelo provedor,
            entrega e leitura. O comprovante verificável reúne identificadores técnicos, trilha de
            auditoria, hash e PDF individual para cada destinatário.
          </p>

          <h2 className="section-title pt-6">O que a Notificas documenta — e o que não assume</h2>
          <p>
            A plataforma registra os eventos técnicos necessários para documentar o ciclo da
            comunicação: conteúdo, envio, entrega, falhas, tentativas e leitura quando disponível.
            Também gera hash, PDF e consulta pública do que estava registrado naquele instante.
          </p>
          <p>
            A Notificas não é autoridade certificadora, não é certificadora ICP-Brasil e não
            cumpre, sozinha, toda obrigação legal de pré-negativação. Não substitui o órgão
            mantenedor do cadastro. Cada cliente permanece responsável pela base legal, pelo
            conteúdo da mensagem e pelo cumprimento das normas aplicáveis, inclusive o CDC e a
            LGPD.
          </p>

          <h2 className="section-title pt-6">Para quem faz sentido</h2>
          <p>
            Operações de cobrança, crédito, varejo com financiamento próprio, telecom, utilities e
            áreas jurídicas que precisam comunicar inadimplência em volume e guardar evidência de
            envio e entrega. O encaixe típico é API ou lote, com dossiê por destinatário — não um
            relatório genérico do disparo.
          </p>
          <p>
            Planos são personalizados. Não publicamos tabela de preços. A cotação comercial pode
            ser feita em USD, conforme volume e canal.
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
                Ver a plataforma no Brasil
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

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  FileText,
  Fingerprint,
  Hash,
  Mail,
  MessageCircle,
  Scale,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { BrazilHeader } from "@/components/br/brazil-header";
import { BrazilQuoteForm } from "@/components/br/brazil-quote-form";
import { JsonLd } from "@/components/json-ld";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BRAZIL_FAQ_ITEMS,
  BRAZIL_PATH,
  BRAZIL_PRE_NEGATIVACAO_PATH,
  BRAZIL_VERIFY_PATH,
  STJ_TEMA_1315_URL,
  brazilFaqJsonLd,
  brazilOrganizationJsonLd,
  brazilSoftwareJsonLd,
} from "@/lib/brazil-site";

const CHANNELS: {
  icon: LucideIcon;
  title: string;
  outline: string;
  events: { title: string; description: string }[];
}[] = [
  {
    icon: Mail,
    title: "E-mail",
    outline: "Envio, eventos de entrega e abertura quando disponível",
    events: [
      {
        title: "Envio",
        description:
          "Qual texto saiu, para quem e quando. Se o servidor de e-mail aceitou o disparo, isso fica registrado. Aceitar o envio não é o mesmo que entregar na caixa de entrada.",
      },
      {
        title: "Entrega",
        description:
          "Quando o provedor informa que a mensagem chegou ao destino, o evento entra na trilha de auditoria. É esse o fato que costuma importar em cobrança e crédito.",
      },
      {
        title: "Abertura",
        description:
          "Se houver sinal técnico de abertura ou acesso ao conteúdo, esse fato também é documentado — separado da entrega.",
      },
    ],
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    outline: "Envio, entrega ao aparelho e leitura quando disponível",
    events: [
      {
        title: "Envio",
        description:
          "Registra-se a mensagem enviada, com identificadores técnicos da plataforma e os dados daquele destinatário.",
      },
      {
        title: "Entrega",
        description:
          "Quando a plataforma informa que o aviso chegou ao aparelho, a entrega entra no dossiê. Entregar no celular não é o mesmo que o destinatário ter lido.",
      },
      {
        title: "Leitura",
        description:
          "Se a plataforma marcar a mensagem como lida, esse evento é registrado à parte da entrega.",
      },
    ],
  },
];

const FLOW_STEPS = [
  {
    id: "criada",
    label: "Criada",
    detail: "A comunicação entra na operação, com destinatário e conteúdo definidos.",
  },
  {
    id: "enviada",
    label: "Enviada",
    detail: "O disparo sai do sistema. Ainda não prova que chegou.",
  },
  {
    id: "aceita",
    label: "Aceita pelo provedor",
    detail: "O servidor de e-mail ou a plataforma aceitou processar a mensagem.",
  },
  {
    id: "entregue",
    label: "Entregue",
    highlight: true,
    detail: "O canal informa que a mensagem chegou ao destino. Este é o passo mais relevante no Brasil.",
  },
  {
    id: "lida",
    label: "Lida",
    detail: "Leitura ou abertura, somente quando o canal disponibiliza o evento.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    title: "Dispare por lote, API ou painel",
    body: "A operação envia centenas ou milhões de comunicações a partir do sistema interno, de uma planilha ou do painel. Cada destinatário vira um registro próprio, não uma linha perdida num relatório genérico.",
  },
  {
    title: "O canal conta o que aconteceu depois",
    body: "A Notificas não registra só a saída. Guarda envio, aceitação pelo provedor, entrega quando o canal informa, leitura quando disponível, falhas e novas tentativas.",
  },
  {
    title: "Cada envio gera um comprovante verificável",
    body: "O dossiê reúne conteúdo, identificadores, trilha de auditoria, hash e PDF. Qualquer pessoa consulta a evidência na página pública, sem precisar de login.",
  },
] as const;

const EVIDENCE_ITEMS = [
  {
    title: "Conteúdo enviado",
    body: "O texto que de fato saiu naquele disparo, não um resumo posterior.",
  },
  {
    title: "Destinatário",
    body: "Para quem a comunicação foi dirigida naquele envio.",
  },
  {
    title: "Data e hora",
    body: "Quando cada evento disponível ocorreu.",
  },
  {
    title: "Canal utilizado",
    body: "E-mail, WhatsApp ou os dois, com rastro separado por canal.",
  },
  {
    title: "Identificador da mensagem",
    body: "Referências técnicas do provedor ou da plataforma.",
  },
  {
    title: "Status de envio",
    body: "Se a mensagem saiu e se o provedor aceitou processá-la.",
  },
  {
    title: "Confirmação de entrega",
    body: "Quando o canal informa que chegou ao destino.",
  },
  {
    title: "Leitura, quando disponível",
    body: "Evento distinto da entrega, só se o canal o disponibilizar.",
  },
  {
    title: "Falhas e novas tentativas",
    body: "O que não chegou e o que foi reenviado.",
  },
  {
    title: "Hash",
    body: "Impressão digital do registro, para conferir integridade depois.",
  },
  {
    title: "PDF individual",
    body: "Comprovante por destinatário, gerado a partir do que estava registrado naquele instante.",
  },
  {
    title: "Relatório de lote",
    body: "Visão consolidada da operação em massa, sem misturar os dossiês.",
  },
  {
    title: "Link público de verificação",
    body: "Consulta independente do comprovante, sem conta na plataforma.",
  },
] as const;

const USE_CASES = [
  {
    title: "Pré-negativação",
    body: "Comunicações prévias a cadastros de inadimplência, com registro de conteúdo, envio e entrega. A Notificas documenta o ciclo técnico; a empresa permanece responsável pela obrigação legal.",
  },
  {
    title: "Cobrança",
    body: "Avisos de vencimento, propostas de acordo, prazos e regularização. Cada disparo deixa comprovante verificável, em volume diário ou campanha pontual.",
  },
  {
    title: "Bancos e fintechs",
    body: "Comunicações de crédito, atraso, inadimplência e relacionamento. A trilha de auditoria acompanha o que o canal informou depois do envio.",
  },
  {
    title: "Varejo e financiamento próprio",
    body: "Cobranças e avisos contratuais em escala — loja, e-commerce ou carteira própria — com o mesmo dossiê por cliente.",
  },
  {
    title: "Telecom e utilities",
    body: "Avisos de dívida, suspensão, religação e regularização, em operações que misturam alto volume e necessidade de prova de envio.",
  },
  {
    title: "Jurídico",
    body: "Notificações extrajudiciais e comunicações documentadas. A evidência é técnica: não substitui intimação judicial nem forma que a lei exija de outro modo.",
  },
] as const;

const SCALE_POINTS = [
  { title: "Upload de lotes", body: "Planilhas e arquivos para disparos em massa." },
  { title: "API", body: "Integração com cobrança, crédito e sistemas internos." },
  { title: "Processamento automático", body: "A operação segue sem tratar mensagem por mensagem à mão." },
  { title: "Relatórios consolidados", body: "Acompanhamento do lote inteiro e do destinatário." },
  { title: "PDFs individuais", body: "Comprovante por comunicação, não só um extrato geral." },
  { title: "Rastreamento por mensagem", body: "Status próprio de envio, entrega e leitura." },
  { title: "Exportação", body: "Saída dos registros para o arquivo da empresa." },
  { title: "Webhooks", body: "Eventos de volta para o sistema do cliente." },
  { title: "Sistemas internos", body: "Encaixa na operação que vocês já usam." },
] as const;

const REASONS = [
  {
    title: "Evidência individual",
    body: "Cada comunicação gera o próprio registro técnico, com conteúdo, canal e eventos.",
  },
  {
    title: "Escala",
    body: "O mesmo critério serve para um envio avulso ou para milhões de destinatários.",
  },
  {
    title: "API",
    body: "A operação de cobrança, crédito ou jurídico dispara e consulta sem sair do sistema interno.",
  },
  {
    title: "Multicanal",
    body: "E-mail e WhatsApp no mesmo produto. Um canal ou os dois, cada um com o próprio rastro.",
  },
  {
    title: "Auditoria",
    body: "Histórico técnico de eventos, tentativas e falhas — o que aconteceu depois que a mensagem saiu.",
  },
  {
    title: "Verificação",
    body: "Terceiros conferem o comprovante na consulta pública, sem depender do remetente.",
  },
  {
    title: "Automação",
    body: "Menos trabalho manual para disparar, acompanhar e documentar cada destinatário.",
  },
  {
    title: "Custo",
    body: "Alternativa digital a processos tradicionais de comunicação em papel ou disparos sem rastro.",
  },
] as const;

const NOT_CLAIMS = [
  "Não é autoridade certificadora nem certificadora ICP-Brasil.",
  "Não substitui o órgão mantenedor do cadastro de proteção ao crédito.",
  "Não cumpre, sozinha, a obrigação legal de pré-negativação.",
  "Não é escritório de advocacia nem empresa de cobrança.",
  "Não publica preços, clientes brasileiros nem CNPJ no Brasil.",
] as const;

function BrazilHeaderActions() {
  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      <Button size="lg" className="w-full sm:w-auto" asChild>
        <Link href={`${BRAZIL_PATH}#cotacao`}>Solicitar cotação</Link>
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
        asChild
      >
        <Link href={`${BRAZIL_PATH}?pedido=demonstracao#cotacao`}>Solicitar demonstração</Link>
      </Button>
    </div>
  );
}

export function BrazilLanding() {
  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd data={brazilOrganizationJsonLd()} />
      <JsonLd data={brazilSoftwareJsonLd()} />
      <JsonLd data={brazilFaqJsonLd()} />
      <BrazilHeader />

      <main className="flex-1">
        <section className="landing-hero px-4 py-16 sm:py-20 md:py-24">
          <div className="container grid items-start gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.75fr)] lg:gap-12">
            <div className="landing-hero-copy">
              <h1 className="hero-title mb-5">
                Notificações digitais com
                <br className="hidden lg:block" /> evidências de envio e entrega
              </h1>
              <p className="landing-hero-muted mb-6 max-w-[65ch] text-pretty text-[1.0625rem] font-normal leading-[1.55] tracking-[-0.01em]">
                Envie comunicações por WhatsApp e e-mail e gere automaticamente evidências
                técnicas de conteúdo, data, hora, envio, entrega e leitura quando disponível.
              </p>
              <p className="landing-hero-muted mb-4 max-w-[62ch] text-[0.975rem] leading-relaxed">
                A Notificas é infraestrutura para empresas que precisam documentar o ciclo da
                mensagem — não apenas disparar. Cada destinatário deixa um comprovante
                verificável: trilha de auditoria, hash, PDF individual e consulta pública.
              </p>
              <p className="landing-hero-muted mb-8 max-w-[52ch] text-sm leading-relaxed">
                Para empresas, cobrança, crédito, jurídico e operações de alto volume.
              </p>
              <BrazilHeaderActions />
            </div>

            <aside className="landing-hero-proof" aria-label="O que fica registrado em cada canal">
              <p className="text-lg font-semibold tracking-tight text-white">
                Evidência digital por canal
              </p>
              <p className="landing-hero-muted mt-1 max-w-[48ch] text-sm leading-relaxed">
                Envie por um canal ou pelos dois. Cada um deixa o próprio rastro técnico.
              </p>

              <div className="mt-5 border-t border-white/15">
                {CHANNELS.map((channel) => (
                  <details
                    key={channel.title}
                    className="group border-b border-white/15 open:[&_svg.hero-chevron]:rotate-180"
                  >
                    <summary className="flex cursor-pointer list-none items-start gap-3 py-3.5 outline-none [&::-webkit-details-marker]:hidden [&::marker]:content-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(208_38%_20%)]">
                      <channel.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-white">{channel.title}</span>
                        <span className="landing-hero-muted mt-0.5 block text-sm font-normal">
                          {channel.outline}
                        </span>
                      </span>
                      <ArrowRight
                        className="hero-chevron mt-1 h-4 w-4 shrink-0 rotate-90 text-white/80 transition-transform duration-200"
                        aria-hidden
                      />
                    </summary>
                    <ol className="border-l border-white/20 pb-4 pl-5">
                      {channel.events.map((event) => (
                        <li key={event.title} className="pb-3 last:pb-0">
                          <p className="font-medium leading-snug text-white">{event.title}</p>
                          <p className="landing-hero-muted mt-0.5 text-sm leading-relaxed">
                            {event.description}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>

              <div className="pt-5">
                <p className="flex items-center gap-2 font-semibold text-white">
                  <FileText className="h-4 w-4" aria-hidden />
                  Comprovante verificável
                </p>
                <p className="landing-hero-muted mt-1 max-w-[48ch] text-sm leading-relaxed">
                  PDF individual, hash e consulta pública do que foi registrado até aquele instante.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <h2 className="section-title mb-4 max-w-[28ch]">Como a evidência é gerada</h2>
            <p className="mb-10 max-w-[65ch] leading-relaxed text-muted-foreground">
              O produto resolve um problema simples de operação: disparar em volume e ainda assim
              saber, destinatário por destinatário, o que o canal informou depois. Sem inventar
              valor jurídico automático — com registro técnico que dá para conferir.
            </p>
            <ol className="grid gap-10 md:grid-cols-3">
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step.title} className="max-w-[48ch]">
                  <p className="feature-title">
                    <span className="text-primary">{index + 1}.</span> {step.title}
                  </p>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="pre-negativacao"
          className="landing-band scroll-mt-24 px-4 py-16 sm:py-20 md:py-24"
        >
          <div className="container grid items-start gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] lg:gap-16">
            <div>
              <h2 className="section-title mb-4 max-w-[28ch]">
                Comunicações de <span className="whitespace-nowrap">pré-negativação</span> com
                rastreabilidade
              </h2>
              <p className="max-w-[65ch] leading-relaxed text-muted-foreground">
                Antes de incluir um nome em cadastro de inadimplência, a operação brasileira
                precisa comunicar o consumidor. A Notificas entra como infraestrutura tecnológica
                dessa comunicação prévia: dispara por e-mail e WhatsApp e documenta o ciclo
                técnico. Não substitui, por si só, o cumprimento de toda obrigação legal do credor
                ou do órgão mantenedor do cadastro.
              </p>
              <p className="mt-4 max-w-[65ch] leading-relaxed text-muted-foreground">
                O Superior Tribunal de Justiça consolidou em 2026 o entendimento de que a
                comunicação eletrônica prevista no art. 43, §2º, do Código de Defesa do Consumidor
                pode ser válida quando comprovada a entrega da notificação ao destinatário.
              </p>
              <p className="mt-4 max-w-[65ch] leading-relaxed text-muted-foreground">
                Por isso o mercado deixou de se contentar com “a mensagem saiu”. O que importa é
                conseguir mostrar o conteúdo, o destinatário, a data e — sobretudo — a entrega
                quando o canal a informa. A Notificas registra os eventos técnicos necessários
                para documentar esse ciclo: conteúdo, envio, entrega, falhas, tentativas e leitura
                quando disponível.
              </p>
              <p className="mt-6 text-sm text-muted-foreground">Tema Repetitivo 1.315 / STJ</p>
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                <a
                  href={STJ_TEMA_1315_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Ver decisão do STJ
                </a>
                <Link
                  href={BRAZIL_PRE_NEGATIVACAO_PATH}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Entenda a pré-negativação com evidência
                </Link>
              </p>
            </div>
            <aside className="rounded-lg border border-border bg-card p-6 sm:p-8 dark:border-white/10 dark:bg-[hsl(215_28%_22%)]">
              <p className="feature-title">Prova de envio e entrega</p>
              <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
                No mercado brasileiro a chave não está só em mandar a mensagem. Está em documentar
                o que aconteceu depois: se o provedor aceitou, se houve entrega e se existiu
                leitura.
              </p>
              <ul className="mt-6 space-y-3 text-sm leading-relaxed">
                <li>conteúdo exato enviado</li>
                <li>destinatário, data e hora</li>
                <li>entrega quando o canal informa</li>
                <li>trilha de auditoria e PDF</li>
              </ul>
            </aside>
          </div>
        </section>

        <section id="entrega" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <h2 className="section-title mb-4 max-w-[20ch]">
              Enviar não é o mesmo que entregar.
            </h2>
            <p className="mb-10 max-w-[58ch] leading-relaxed text-muted-foreground">
              Não registre apenas que uma mensagem saiu do sistema. Registre o que aconteceu
              depois. Cada etapa abaixo é um fato distinto; a Notificas guarda as que o canal
              disponibiliza.
            </p>
            <ol className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-stretch">
              {FLOW_STEPS.map((step, index) => (
                <li key={step.id} className="flex items-stretch md:max-w-none md:flex-1">
                  {index > 0 ? (
                    <span
                      className="mx-0 my-auto hidden h-px w-4 shrink-0 bg-border md:block dark:bg-white/20"
                      aria-hidden
                    />
                  ) : null}
                  <div
                    className={
                      "highlight" in step && step.highlight
                        ? "flex min-h-[4.5rem] flex-1 items-center justify-center rounded-lg border border-primary bg-primary px-4 py-3 text-center text-primary-foreground"
                        : "flex min-h-[4.5rem] flex-1 items-center justify-center rounded-lg border border-border bg-card px-4 py-3 text-center dark:border-white/10 dark:bg-[hsl(215_28%_22%)]"
                    }
                  >
                    <span className="text-sm font-semibold tracking-tight sm:text-base">
                      {step.label}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {FLOW_STEPS.map((step) => (
                <li key={`${step.id}-detail`} className="max-w-[36ch]">
                  <p className="text-sm font-semibold tracking-tight">{step.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 max-w-[58ch] leading-relaxed text-muted-foreground">
              A Notificas registra cada etapa disponível da comunicação. A evidência de{" "}
              <strong className="font-semibold text-foreground">entrega</strong> tem particular
              relevância para operações brasileiras de cobrança e crédito.
            </p>
          </div>
        </section>

        <section id="evidencias" className="landing-band scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <h2 className="section-title mb-4 max-w-[22ch]">
              Uma comunicação. Um dossiê de evidências.
            </h2>
            <p className="mb-10 max-w-[65ch] leading-relaxed text-muted-foreground">
              Cada envio gera um registro técnico próprio. A lista abaixo descreve a estrutura do
              dossiê — não é um caso real nem um exemplo judicial. Nada aqui afirma validade
              automática em juízo.
            </p>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <ul className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
                {EVIDENCE_ITEMS.map((item) => (
                  <li key={item.title} className="max-w-[48ch] border-b border-border/70 pb-5 dark:border-white/10">
                    <p className="font-semibold tracking-tight">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </li>
                ))}
              </ul>
              <aside className="rounded-lg border border-border bg-card p-6 dark:border-white/10 dark:bg-[hsl(215_28%_22%)]">
                <p className="flex items-center gap-2 font-semibold tracking-tight">
                  <Fingerprint className="h-5 w-5 text-primary" aria-hidden />
                  Integridade criptográfica
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Cada evidência pode ser associada a um hash que permite verificar posteriormente
                  sua integridade. A camada criptográfica complementa o registro técnico; não é o
                  argumento comercial principal no Brasil.
                </p>
                <p className="mt-6">
                  <Button asChild>
                    <Link href={BRAZIL_VERIFY_PATH}>Verificar evidência</Link>
                  </Button>
                </p>
              </aside>
            </div>
          </div>
        </section>

        <section id="cobranca" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <h2 className="section-title mb-4 max-w-3xl">Infraestrutura para cobrança e crédito</h2>
            <p className="mb-10 max-w-[65ch] leading-relaxed text-muted-foreground">
              A mesma plataforma serve a operações que precisam avisar, cobrar ou regularizar em
              volume — e guardar o que o canal informou depois do disparo.
            </p>
            <div className="grid gap-x-12 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map((item) => (
                <article key={item.title} className="max-w-[48ch]">
                  <h3 className="feature-title">{item.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="escala" className="landing-band scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div>
              <h2 className="section-title mb-4">De centenas a milhões de comunicações</h2>
              <p className="max-w-[65ch] leading-relaxed text-muted-foreground">
                A Notificas foi projetada para operações individuais e em massa. Planos
                personalizados para operações em escala, com condições especiais para grandes
                volumes. Não publicamos tabela: a cotação depende do canal, do volume mensal e de
                como o disparo entra na plataforma.
              </p>
              <p className="mt-4 max-w-[65ch] leading-relaxed text-muted-foreground">
                API, lotes e webhooks existem para a operação continuar no sistema que a empresa já
                usa. O dossiê por destinatário não desaparece quando o volume cresce.
              </p>
              <p className="mt-8">
                <Button size="lg" asChild>
                  <Link href={`${BRAZIL_PATH}#cotacao`}>Solicitar cotação por volume</Link>
                </Button>
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {SCALE_POINTS.map((item) => (
                <li key={item.title} className="border-b border-border/70 py-2 dark:border-white/10">
                  <p className="text-sm font-semibold leading-snug">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="canais" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <h2 className="section-title mb-4">WhatsApp e e-mail, com o mesmo critério de evidência</h2>
            <p className="mb-10 max-w-[65ch] leading-relaxed text-muted-foreground">
              Use um canal ou combine ambos em uma estratégia multicanal. Cada canal deixa o
              próprio rastro; a evidência de um não se mistura com a do outro. Não afirmamos
              fallback automático entre canais: a combinação é da operação, com o mesmo padrão de
              registro.
            </p>
            <div className="grid gap-12 lg:grid-cols-2">
              <article className="max-w-[54ch]">
                <h3 className="feature-title flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" aria-hidden />
                  WhatsApp
                </h3>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  <li>Comunicação direta no aplicativo que a pessoa já usa.</li>
                  <li>Alta velocidade de disparo em operação assistida ou integrada.</li>
                  <li>Confirmação de entrega quando a plataforma disponibiliza o evento.</li>
                  <li>Leitura quando disponível — fato distinto da entrega ao aparelho.</li>
                  <li>Identificadores técnicos da mensagem para auditoria posterior.</li>
                  <li>Templates aprovados pela plataforma, com os dados daquele destinatário.</li>
                  <li>Integração via API com o sistema interno de cobrança ou crédito.</li>
                </ul>
              </article>
              <article className="max-w-[54ch]">
                <h3 className="feature-title flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" aria-hidden />
                  E-mail
                </h3>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  <li>Envio em massa com o mesmo dossiê por destinatário.</li>
                  <li>Registro do conteúdo que de fato foi disparado.</li>
                  <li>Marcação de data e hora em cada evento disponível.</li>
                  <li>Eventos de entrega quando o provedor os informa.</li>
                  <li>Abertura quando houver sinal técnico — não confundir com entrega.</li>
                  <li>Evidência individual, mesmo em lotes grandes.</li>
                  <li>Custo operacional baixo para comunicações recorrentes.</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="cotacao" className="landing-band scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <div className="mb-10 max-w-3xl md:mb-12">
              <h2 className="section-title mb-4">Solicite uma cotação</h2>
              <p className="max-w-[65ch] leading-relaxed text-muted-foreground">
                Planos personalizados para operações em escala. As condições dependem do canal e
                do volume. Não publicamos tabela de preços. A conversa comercial pode ser feita em
                USD, conforme o volume e o canal.
              </p>
            </div>
            <div className="grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-2 dark:border-white/10 dark:bg-[hsl(215_28%_22%)]">
              <div className="border-border p-6 sm:p-8 lg:border-r dark:border-white/10">
                <h3 className="font-headline text-xl font-bold tracking-[-0.025em] text-foreground">
                  Receber cotação
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Informe empresa, CNPJ, volume mensal, canal e a finalidade da comunicação.
                  Também dá para pedir uma demonstração com envios reais na sua operação.
                </p>
                <div className="mt-6">
                  <BrazilQuoteForm />
                </div>
              </div>
              <aside className="flex h-full flex-col p-6 sm:p-8">
                <h3 className="font-headline text-xl font-bold leading-snug tracking-[-0.025em] text-foreground">
                  O que avaliamos na cotação
                </h3>
                <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
                  Volume, canal, tipo de comunicação e necessidade de API ou envio em lote. Sem
                  tabela pública: cada operação tem uma proposta.
                </p>
                <ul className="mt-8 space-y-5">
                  <li className="flex gap-3">
                    <Workflow className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="feature-title">Operação em escala</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        De centenas a milhões de comunicações, com rastreamento por mensagem.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="feature-title">Uso empresarial</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Cobrança, crédito, jurídico e operações que precisam de comprovante
                        verificável.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="feature-title">Trilha de auditoria</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Conteúdo, envio, entrega e leitura quando o canal disponibiliza o evento.
                      </p>
                    </div>
                  </li>
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section id="porque" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container">
            <h2 className="section-title mb-10 max-w-3xl">Por que Notificas</h2>
            <div className="grid gap-x-12 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
              {REASONS.map((item) => (
                <article key={item.title} className="max-w-[42ch]">
                  <h3 className="feature-title">{item.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="lgpd" className="landing-band scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container grid gap-10 lg:grid-cols-2">
            <article>
              <h2 className="section-title mb-4">Dados tratados com responsabilidade</h2>
              <p className="max-w-[65ch] leading-relaxed text-muted-foreground">
                A LGPD prevê diferentes bases legais para o tratamento de dados pessoais, incluindo
                a proteção do crédito. Cada cliente continua responsável por definir a base legal
                adequada para sua operação.
              </p>
              <p className="mt-4 max-w-[65ch] leading-relaxed text-muted-foreground">
                A Notificas registra e processa apenas os dados necessários para executar e
                documentar as comunicações contratadas. Não afirmamos certificação da ANPD nem
                conformidade automática.
              </p>
              <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                Arquitetura pensada para operações sujeitas à LGPD.
              </p>
            </article>
            <article>
              <h2 className="section-title mb-4">Integridade criptográfica e verificabilidade</h2>
              <p className="max-w-[65ch] leading-relaxed text-muted-foreground">
                Cada evidência pode ser associada a um hash que permite verificar posteriormente
                sua integridade. A camada criptográfica complementa o registro técnico; não é o
                argumento comercial principal no Brasil e não substitui carimbo do tempo ICP-Brasil.
              </p>
              <p className="mt-4 flex items-start gap-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                <Hash className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Arquitetura preparada para integração com serviços de confiança e carimbo do tempo.
              </p>
            </article>
          </div>
        </section>

        <section id="brasil" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
          <div className="container grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div>
              <h2 className="section-title mb-4">Comunicações digitais no Brasil</h2>
              <p className="max-w-[65ch] leading-relaxed text-muted-foreground">
                O art. 43, §2º, do Código de Defesa do Consumidor prevê a comunicação ao consumidor
                sobre a abertura de cadastro não solicitado.
              </p>
              <p className="mt-4 max-w-[65ch] leading-relaxed text-muted-foreground">
                A Súmula 359 do STJ atribui ao órgão mantenedor do cadastro de proteção ao crédito o
                dever de notificar o devedor antes da inscrição.
              </p>
              <p className="mt-4 max-w-[65ch] leading-relaxed text-muted-foreground">
                Em 2026, no Tema Repetitivo 1.315, o STJ reconheceu a validade da comunicação
                eletrônica quando comprovada sua entrega ao destinatário. O ponto operacional é
                conseguir documentar essa entrega — não apenas o disparo.
              </p>
              <p className="mt-6">
                <Link
                  href={BRAZIL_PRE_NEGATIVACAO_PATH}
                  className="inline-flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Saiba mais sobre pré-negativação
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </p>
              <p className="mt-8 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <Scale className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Texto educativo. Não constitui aconselhamento jurídico.
              </p>
            </div>
            <aside>
              <h2 className="section-title mb-4">O que a Notificas não é</h2>
              <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                {NOT_CLAIMS.map((item) => (
                  <li key={item} className="border-b border-border/70 pb-3 last:border-b-0 dark:border-white/10">
                    {item}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section id="faq" className="landing-band scroll-mt-24 px-4 pt-16 pb-8 sm:pt-20 md:pt-24">
          <div className="container">
            <h2 className="section-title mb-8">Perguntas frequentes</h2>
            <Accordion type="single" collapsible className="w-full">
              {BRAZIL_FAQ_ITEMS.map((item, index) => (
                <AccordionItem key={item.question} value={`faq-br-${index}`}>
                  <AccordionTrigger className="py-4 text-left text-sm hover:no-underline data-[state=open]:underline sm:text-base">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="pt-0">
                    <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground md:text-base">
                      {item.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="landing-hero px-4 py-16 sm:py-20 md:py-24">
          <div className="container max-w-3xl">
            <h2 className="hero-title mb-5">Quer testar Notificas na sua operação?</h2>
            <p className="landing-hero-muted mb-8 max-w-[58ch] text-pretty text-[1.0625rem] leading-[1.55]">
              Envie algumas comunicações, analise as evidências geradas e compare com seu processo
              atual. Dá para começar por uma demonstração ou ir direto à cotação de volume.
            </p>
            <BrazilHeaderActions />
            <p className="mt-6">
              <a
                href="mailto:contacto@notificas.com"
                className="text-sm font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
              >
                Falar com um especialista
              </a>
            </p>
          </div>
        </section>
      </main>
      <PublicFooter locale="pt-BR" />
    </div>
  );
}

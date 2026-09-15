import type { Metadata } from "next";

import {
  ARGENTINA_ORIGIN,
  BRAZIL_PATH_PREFIX,
  INTERNATIONAL_ORIGIN,
} from "@/lib/international-site";
import { SITE_CONTACT, SITE_LEGAL_NAME, SITE_NAME } from "@/lib/seo";

export const BRAZIL_PATH = BRAZIL_PATH_PREFIX;
export const BRAZIL_PRE_NEGATIVACAO_PATH = `${BRAZIL_PATH_PREFIX}/pre-negativacao`;
export const BRAZIL_VERIFY_PATH = `${BRAZIL_PATH_PREFIX}/verificar`;
export const BRAZIL_TERMS_PATH = `${BRAZIL_PATH_PREFIX}/termos`;

export const BRAZIL_ORIGIN = INTERNATIONAL_ORIGIN;
export const BRAZIL_HOME_URL = `${BRAZIL_ORIGIN}${BRAZIL_PATH}`;
export const BRAZIL_PRE_NEGATIVACAO_URL = `${BRAZIL_ORIGIN}${BRAZIL_PRE_NEGATIVACAO_PATH}`;
export const BRAZIL_VERIFY_URL = `${BRAZIL_ORIGIN}${BRAZIL_VERIFY_PATH}`;
export const BRAZIL_TERMS_URL = `${BRAZIL_ORIGIN}${BRAZIL_TERMS_PATH}`;

/** Página oficial do STJ para o Tema Repetitivo 1.315. */
export const STJ_TEMA_1315_URL =
  "https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial=1315&cod_tema_final=1315";

export const BRAZIL_TITLE =
  "Notificas Brasil | Notificações por WhatsApp e E-mail com Evidências";
export const BRAZIL_DESCRIPTION =
  "Envie notificações digitais por WhatsApp e e-mail com registro de conteúdo, envio, entrega, leitura quando disponível, trilha de auditoria e evidências verificáveis.";

export const BRAZIL_PRE_NEGATIVACAO_TITLE =
  "Pré-negativação | Notificação eletrônica com prova de entrega";
export const BRAZIL_PRE_NEGATIVACAO_DESCRIPTION =
  "Infraestrutura tecnológica para comunicações prévias de pré-negativação, com registro técnico de conteúdo, envio, entrega e leitura quando disponível. Tema 1.315 do STJ.";

export const BRAZIL_FUTURE_SEO_PATHS = [
  "/br/notificacao-eletronica",
  "/br/notificacao-whatsapp",
  "/br/email-com-evidencia",
  "/br/cobranca-digital",
  "/br/api",
] as const;

export const BRAZIL_KEYWORDS = [
  "notificação eletrônica",
  "notificação digital",
  "notificação WhatsApp",
  "email com comprovação de entrega",
  "WhatsApp com comprovação de entrega",
  "pré-negativação",
  "cobrança digital",
  "evidência digital",
  "API notificações",
] as const;

export const BRAZIL_SITEMAP_LASTMOD = new Date("2026-09-14T00:00:00.000Z");

export const BRAZIL_THEME_LABELS = {
  light: "Claro",
  dark: "Escuro",
  system: "Sistema",
} as const;

export const BRAZIL_NAV_LINKS = [
  { href: `${BRAZIL_PATH}#como-funciona`, label: "Como funciona" },
  { href: `${BRAZIL_PATH}#evidencias`, label: "Evidências" },
  { href: `${BRAZIL_PATH}#pre-negativacao`, label: "Pré-negativação" },
  { href: `${BRAZIL_PATH}#cotacao`, label: "Cotação" },
  { href: BRAZIL_VERIFY_PATH, label: "Verificar" },
] as const;

export const BRAZIL_VOLUME_OPTIONS = [
  { value: "ate-10000", label: "até 10.000" },
  { value: "10000-50000", label: "10.000–50.000" },
  { value: "50000-100000", label: "50.000–100.000" },
  { value: "100000-500000", label: "100.000–500.000" },
  { value: "500000-1000000", label: "500.000–1.000.000" },
  { value: "mais-1000000", label: "mais de 1.000.000" },
] as const;

export const BRAZIL_FINALIDADE_OPTIONS = [
  { value: "cobranca", label: "Cobrança" },
  { value: "pre-negativacao", label: "Pré-negativação" },
  { value: "notificacao-contratual", label: "Notificação contratual" },
  { value: "juridico", label: "Jurídico" },
  { value: "credito", label: "Crédito" },
  { value: "outros", label: "Outros" },
] as const;

export type BrazilVolumeValue = (typeof BRAZIL_VOLUME_OPTIONS)[number]["value"];
export type BrazilFinalidadeValue =
  (typeof BRAZIL_FINALIDADE_OPTIONS)[number]["value"];

export function brazilPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  keywords?: readonly string[];
}): Metadata {
  const url = `${BRAZIL_ORIGIN}${opts.path}`;
  return {
    metadataBase: new URL(BRAZIL_ORIGIN),
    title: { absolute: opts.title },
    description: opts.description,
    applicationName: SITE_NAME,
    keywords: opts.keywords ? [...opts.keywords] : [...BRAZIL_KEYWORDS],
    alternates: {
      canonical: url,
      languages: {
        "pt-BR": url,
        "es-AR": ARGENTINA_ORIGIN,
        es: ARGENTINA_ORIGIN,
        "x-default": INTERNATIONAL_ORIGIN,
      },
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url,
      siteName: SITE_NAME,
      title: opts.title,
      description: opts.description,
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export function brazilLandingMetadata(): Metadata {
  return brazilPageMetadata({
    title: BRAZIL_TITLE,
    description: BRAZIL_DESCRIPTION,
    path: BRAZIL_PATH,
  });
}

export function brazilPreNegativacaoMetadata(): Metadata {
  return brazilPageMetadata({
    title: BRAZIL_PRE_NEGATIVACAO_TITLE,
    description: BRAZIL_PRE_NEGATIVACAO_DESCRIPTION,
    path: BRAZIL_PRE_NEGATIVACAO_PATH,
    keywords: [
      "notificação prévia negativação",
      "notificação eletrônica negativação",
      "notificação por WhatsApp negativação",
      "Tema 1315 STJ",
      "artigo 43 CDC notificação",
      "prova de entrega WhatsApp",
    ],
  });
}

export const BRAZIL_VERIFY_TITLE = "Verificar evidência | Notificas Brasil";
export const BRAZIL_VERIFY_DESCRIPTION =
  "Confira se o comprovante PDF foi gerado pela Notificas e se o conteúdo coincide com o registro técnico original.";

export function brazilVerifyMetadata(): Metadata {
  return brazilPageMetadata({
    title: BRAZIL_VERIFY_TITLE,
    description: BRAZIL_VERIFY_DESCRIPTION,
    path: BRAZIL_VERIFY_PATH,
    keywords: [
      "verificar evidência digital",
      "comprovante de envio e entrega",
      "hash notificação",
      "PDF verificação Notificas",
    ],
  });
}

export const BRAZIL_TERMS_TITLE =
  "Termos e Condições de Uso | Notificas Brasil";
export const BRAZIL_TERMS_DESCRIPTION =
  "Termos e condições de contratação empresarial internacional da Notificas SRL para empresas e organizações que atuam no Brasil.";

export function brazilTermsMetadata(): Metadata {
  return brazilPageMetadata({
    title: BRAZIL_TERMS_TITLE,
    description: BRAZIL_TERMS_DESCRIPTION,
    path: BRAZIL_TERMS_PATH,
    keywords: [
      "termos de uso Notificas",
      "contratação empresarial",
      "LGPD",
      "evidência digital",
    ],
  });
}

export const BRAZIL_FAQ_ITEMS = [
  {
    question: "O que a Notificas faz no Brasil?",
    answer:
      "A Notificas é uma infraestrutura para enviar comunicações digitais por e-mail e WhatsApp e guardar evidência técnica do que aconteceu: conteúdo, destinatário, data, hora, envio, entrega, leitura quando o canal informa, falhas, tentativas, hash, PDF e consulta pública. Não é um escritório de cobrança nem uma certificadora.",
  },
  {
    question: "O que fica registrado em cada comunicação?",
    answer:
      "O conteúdo enviado, o destinatário, a data e a hora, o canal utilizado, identificadores técnicos da mensagem, o status de envio, a confirmação de entrega quando o provedor ou a plataforma informa, a leitura quando disponível, falhas e novas tentativas, o hash, o PDF individual, o relatório de lote e o link público de verificação.",
  },
  {
    question: "Enviar é o mesmo que entregar?",
    answer:
      "Não. O envio registra que a mensagem saiu do sistema ou foi aceita pelo provedor. A entrega registra que o canal informou que a mensagem chegou ao destino — caixa de entrada ou aparelho. A leitura, quando existe, é um terceiro fato. No Brasil, a evidência de entrega é especialmente relevante para cobrança, crédito e comunicações de pré-negativação.",
  },
  {
    question: "A Notificas é uma autoridade certificadora ou certificadora ICP-Brasil?",
    answer:
      "Não. A Notificas gera evidência digital, registro técnico e trilha de auditoria. Não é autoridade certificadora, não é certificadora ICP-Brasil e não emite certificado de assinatura digital. A camada criptográfica (hash e verificabilidade) complementa o dossiê; não substitui um carimbo do tempo de uma ACT acreditada.",
  },
  {
    question: "A Notificas cumpre automaticamente a obrigação de pré-negativação?",
    answer:
      "Não. A plataforma pode ser usada como infraestrutura tecnológica para comunicações prévias relacionadas a cadastros de inadimplência. O credor, o órgão mantenedor do cadastro e a empresa contratante continuam responsáveis pela base legal, pelo conteúdo da mensagem e pelo cumprimento das normas aplicáveis, inclusive o CDC e a LGPD.",
  },
  {
    question: "O Tema 1.315 do STJ significa que qualquer e-mail ou WhatsApp vale como notificação?",
    answer:
      "Não. Em 2026 o STJ consolidou que a comunicação eletrônica prevista no art. 43, §2º, do CDC pode ser válida quando comprovada a entrega ao destinatário. Isso não torna automático qualquer disparo. O ponto prático é documentar o ciclo da mensagem — em especial a entrega — com registro técnico verificável. O texto da landing é educativo e não constitui aconselhamento jurídico.",
  },
  {
    question: "Como funcionam o WhatsApp e o e-mail?",
    answer:
      "No WhatsApp registramos a mensagem enviada, identificadores técnicos, a entrega ao aparelho quando a plataforma informa e a leitura quando disponível. No e-mail registramos o conteúdo, a aceitação do disparo, os eventos de entrega e a abertura quando houver sinal técnico. Cada canal deixa o próprio rastro. Você pode usar um ou os dois.",
  },
  {
    question: "Dá para integrar com o sistema interno da empresa?",
    answer:
      "Sim. Operações em escala entram por API, upload de lotes, webhooks e relatórios. Cada destinatário continua com dossiê próprio: PDF, hash e verificação pública. Na cotação avaliamos volume, canal e o modo de integração.",
  },
  {
    question: "Os dados pessoais ficam de acordo com a LGPD?",
    answer:
      "A LGPD prevê bases legais distintas, inclusive a proteção do crédito. Cada cliente define a base adequada à sua operação. A Notificas registra e processa apenas os dados necessários para executar e documentar as comunicações contratadas. Não afirmamos certificação da ANPD nem conformidade automática.",
  },
  {
    question: "Como funciona a cotação no Brasil?",
    answer:
      "Não publicamos tabela de preços. Os planos são personalizados conforme o canal, o volume mensal e a forma de envio (API ou lote). A conversa comercial pode ser feita em USD. Informe empresa, CNPJ, volume e finalidade e retornamos com uma proposta.",
  },
  {
    question: "Como verifico um comprovante?",
    answer:
      "Abra a página de verificação, envie o PDF gerado ou informe o identificador da comunicação. Comparamos o arquivo e os identificadores com o registro técnico original. A consulta é pública: não é preciso ter conta na plataforma.",
  },
  {
    question: "A empresa é brasileira?",
    answer:
      "A Notificas opera a oferta brasileira a partir da Notificas SRL, na Argentina. Não inventamos CNPJ nem endereço no Brasil. A landing, o idioma e os casos de uso são específicos do mercado brasileiro; a sociedade contratante permanece argentina.",
  },
] as const;

export function brazilOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BRAZIL_HOME_URL}#organization`,
    name: SITE_NAME,
    legalName: SITE_LEGAL_NAME,
    url: BRAZIL_HOME_URL,
    logo: `${ARGENTINA_ORIGIN}/notificasLogo.jpg`,
    email: SITE_CONTACT.email,
    telephone: SITE_CONTACT.phone,
    taxID: SITE_CONTACT.cuit,
    termsOfService: BRAZIL_TERMS_URL,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE_CONTACT.address.streetAddress,
      addressLocality: SITE_CONTACT.address.addressLocality,
      addressRegion: SITE_CONTACT.address.addressRegion,
      addressCountry: SITE_CONTACT.address.addressCountry,
    },
    areaServed: {
      "@type": "Country",
      name: "Brasil",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: SITE_CONTACT.email,
        telephone: SITE_CONTACT.phone,
        availableLanguage: ["Portuguese", "Spanish"],
        areaServed: "BR",
      },
    ],
  };
}

export function brazilSoftwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${BRAZIL_HOME_URL}#software`,
    name: SITE_NAME,
    url: BRAZIL_HOME_URL,
    description: BRAZIL_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    provider: { "@id": `${BRAZIL_HOME_URL}#organization` },
    areaServed: { "@type": "Country", name: "Brasil" },
    featureList: [
      "Notificações por WhatsApp",
      "Notificações por e-mail",
      "Evidência digital e trilha de auditoria",
      "Comprovante verificável de envio e entrega",
      "Integração por API",
    ],
  };
}

export function brazilFaqJsonLd(
  items: ReadonlyArray<{ question: string; answer: string }> = BRAZIL_FAQ_ITEMS
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function brazilBreadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${BRAZIL_ORIGIN}${item.path}`,
    })),
  };
}

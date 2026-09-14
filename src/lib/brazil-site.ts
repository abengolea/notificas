import type { Metadata } from "next";

import {
  ARGENTINA_ORIGIN,
  BRAZIL_PATH_PREFIX,
  INTERNATIONAL_ORIGIN,
} from "@/lib/international-site";
import { SITE_CONTACT, SITE_LEGAL_NAME, SITE_NAME } from "@/lib/seo";

export const BRAZIL_PATH = BRAZIL_PATH_PREFIX;
export const BRAZIL_PRE_NEGATIVACAO_PATH = `${BRAZIL_PATH_PREFIX}/pre-negativacao`;

export const BRAZIL_ORIGIN = INTERNATIONAL_ORIGIN;
export const BRAZIL_HOME_URL = `${BRAZIL_ORIGIN}${BRAZIL_PATH}`;
export const BRAZIL_PRE_NEGATIVACAO_URL = `${BRAZIL_ORIGIN}${BRAZIL_PRE_NEGATIVACAO_PATH}`;

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

export const BRAZIL_FAQ_ITEMS = [
  {
    question: "O que a Notificas registra em cada comunicação?",
    answer:
      "O conteúdo enviado, o destinatário, a data e a hora, o canal utilizado, identificadores técnicos, o status de envio, a confirmação de entrega quando o canal informa, a leitura quando disponível, falhas e novas tentativas, o hash, o PDF individual e a verificação pública.",
  },
  {
    question: "Enviar é o mesmo que entregar?",
    answer:
      "Não. O envio registra que a mensagem saiu do sistema. A entrega registra que o provedor ou a plataforma informou que a mensagem chegou ao destinatário. A Notificas documenta cada etapa disponível, com ênfase na evidência de entrega.",
  },
  {
    question: "A Notificas é uma autoridade certificadora?",
    answer:
      "Não. A Notificas é uma plataforma de infraestrutura para comunicações digitais. Gera evidência digital, registro técnico e trilha de auditoria. Não é autoridade certificadora nem certificadora ICP-Brasil.",
  },
  {
    question: "A Notificas cumpre automaticamente a obrigação de pré-negativação?",
    answer:
      "Não. A Notificas pode ser usada como infraestrutura tecnológica para comunicações prévias relacionadas a cadastros de inadimplência. Cada cliente permanece responsável por sua operação, pela base legal e pelo cumprimento das normas aplicáveis.",
  },
  {
    question: "Como funciona a cotação no Brasil?",
    answer:
      "Os planos são personalizados conforme o canal e o volume. Não publicamos tabela de preços. Solicite uma cotação e avaliamos a operação.",
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

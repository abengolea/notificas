import type { Metadata } from "next";

import {
  ARGENTINA_ORIGIN,
  COLOMBIA_PATH_PREFIX,
  INTERNATIONAL_ORIGIN,
} from "@/lib/international-site";
import { SITE_CONTACT, SITE_LEGAL_NAME, SITE_NAME } from "@/lib/seo";

export { COLOMBIA_PATH_PREFIX };
export const COLOMBIA_PATH = COLOMBIA_PATH_PREFIX;
export const COLOMBIA_PRIVACY_PATH = `${COLOMBIA_PATH_PREFIX}/privacidad`;
export const COLOMBIA_COOKIES_PATH = `${COLOMBIA_PATH_PREFIX}/cookies`;
export const COLOMBIA_TERMS_PATH = `${COLOMBIA_PATH_PREFIX}/terminos`;
export const COLOMBIA_FRAMEWORK_PATH = `${COLOMBIA_PATH_PREFIX}/marco-normativo`;

export const COLOMBIA_ORIGIN = INTERNATIONAL_ORIGIN;
export const COLOMBIA_HOME_URL = `${COLOMBIA_ORIGIN}${COLOMBIA_PATH}`;
export const COLOMBIA_PRIVACY_URL = `${COLOMBIA_ORIGIN}${COLOMBIA_PRIVACY_PATH}`;

export const LEY_2300_URL =
  "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=213990";
export const LEY_1266_URL =
  "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=34488";
export const LEY_1581_URL =
  "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981";

export const COLOMBIA_TITLE =
  "Notificas Colombia | Comunicaciones digitales para cobranza";
export const COLOMBIA_DESCRIPTION =
  "Automatice comunicaciones de cobranza por WhatsApp y correo electrónico. Envíos masivos, trazabilidad, evidencia individual, reportes e integración para empresas en Colombia.";

export const COLOMBIA_KEYWORDS = [
  "comunicaciones de cobranza Colombia",
  "WhatsApp cobranza",
  "correo electrónico cobranza",
  "gestión de cartera",
  "evidencia digital",
  "comunicación previa reporte negativo",
  "automatización cobranza",
  "software empresas de cobranza",
  "envíos masivos Colombia",
] as const;

export const COLOMBIA_SITEMAP_LASTMOD = new Date("2026-09-14T00:00:00.000Z");

export const COLOMBIA_NAV_LINKS = [
  { href: `${COLOMBIA_PATH}#producto`, label: "Producto" },
  { href: `${COLOMBIA_PATH}#cobranza`, label: "Cobranza" },
  { href: `${COLOMBIA_PATH}#integraciones`, label: "Integraciones" },
  { href: `${COLOMBIA_PATH}#demostracion`, label: "Demostración" },
] as const;

export const COLOMBIA_FOOTER_LINKS = [
  { href: `${COLOMBIA_PATH}#producto`, label: "Producto" },
  { href: `${COLOMBIA_PATH}#cobranza`, label: "Cobranza" },
  { href: `${COLOMBIA_PATH}#integraciones`, label: "Integraciones" },
  { href: `${COLOMBIA_PATH}#seguridad`, label: "Seguridad" },
  { href: COLOMBIA_PRIVACY_PATH, label: "Privacidad" },
  { href: COLOMBIA_COOKIES_PATH, label: "Cookies" },
  { href: COLOMBIA_TERMS_PATH, label: "Términos" },
  { href: `${COLOMBIA_PATH}#demostracion`, label: "Contacto" },
] as const;

export const COLOMBIA_ORG_OPTIONS = [
  { value: "cobranza", label: "Empresa de cobranza" },
  { value: "financiera", label: "Entidad financiera" },
  { value: "fintech", label: "Fintech" },
  { value: "cooperativa", label: "Cooperativa" },
  { value: "aseguradora", label: "Aseguradora" },
  { value: "retail", label: "Retail / crédito propio" },
  { value: "servicios", label: "Servicios" },
  { value: "otra", label: "Otra" },
] as const;

export const COLOMBIA_VOLUME_OPTIONS = [
  { value: "menos-1000", label: "Menos de 1.000" },
  { value: "1000-10000", label: "1.000 – 10.000" },
  { value: "10000-50000", label: "10.000 – 50.000" },
  { value: "50000-250000", label: "50.000 – 250.000" },
  { value: "mas-250000", label: "Más de 250.000" },
] as const;

export type ColombiaOrgValue = (typeof COLOMBIA_ORG_OPTIONS)[number]["value"];
export type ColombiaVolumeValue = (typeof COLOMBIA_VOLUME_OPTIONS)[number]["value"];

export function colombiaPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  keywords?: readonly string[];
}): Metadata {
  const url = `${COLOMBIA_ORIGIN}${opts.path}`;
  return {
    metadataBase: new URL(COLOMBIA_ORIGIN),
    title: { absolute: opts.title },
    description: opts.description,
    applicationName: SITE_NAME,
    keywords: opts.keywords ? [...opts.keywords] : [...COLOMBIA_KEYWORDS],
    alternates: {
      canonical: url,
      languages: {
        "es-CO": url,
        "pt-BR": `${INTERNATIONAL_ORIGIN}/br`,
        "es-AR": ARGENTINA_ORIGIN,
        es: ARGENTINA_ORIGIN,
        "x-default": INTERNATIONAL_ORIGIN,
      },
    },
    openGraph: {
      type: "website",
      locale: "es_CO",
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

export function colombiaLandingMetadata(): Metadata {
  return colombiaPageMetadata({
    title: COLOMBIA_TITLE,
    description: COLOMBIA_DESCRIPTION,
    path: COLOMBIA_PATH,
  });
}

export function colombiaOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${COLOMBIA_HOME_URL}#organization`,
    name: SITE_NAME,
    legalName: SITE_LEGAL_NAME,
    url: COLOMBIA_HOME_URL,
    logo: `${ARGENTINA_ORIGIN}/notificasLogo.jpg`,
    email: SITE_CONTACT.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE_CONTACT.address.streetAddress,
      addressLocality: SITE_CONTACT.address.addressLocality,
      addressRegion: SITE_CONTACT.address.addressRegion,
      addressCountry: SITE_CONTACT.address.addressCountry,
    },
    areaServed: {
      "@type": "Country",
      name: "Colombia",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: SITE_CONTACT.email,
        availableLanguage: ["Spanish"],
        areaServed: "CO",
      },
    ],
  };
}

export function colombiaSoftwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${COLOMBIA_HOME_URL}#software`,
    name: SITE_NAME,
    url: COLOMBIA_HOME_URL,
    description: COLOMBIA_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "es-CO",
    provider: { "@id": `${COLOMBIA_HOME_URL}#organization` },
    areaServed: { "@type": "Country", name: "Colombia" },
    featureList: [
      "Comunicaciones de cobranza por WhatsApp",
      "Comunicaciones de cobranza por correo electrónico",
      "Envíos masivos de cartera",
      "Evidencia individual y trazabilidad",
      "Reportes e integración por API",
    ],
  };
}

export function colombiaWebPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${COLOMBIA_HOME_URL}#webpage`,
    url: COLOMBIA_HOME_URL,
    name: COLOMBIA_TITLE,
    description: COLOMBIA_DESCRIPTION,
    inLanguage: "es-CO",
    isPartOf: { "@id": `${COLOMBIA_HOME_URL}#organization` },
    about: [
      "comunicaciones de cobranza Colombia",
      "WhatsApp cobranza",
      "gestión de cartera",
      "evidencia digital",
      "comunicación previa reporte negativo",
    ],
  };
}

export function colombiaBreadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${COLOMBIA_ORIGIN}${item.path}`,
    })),
  };
}

import type { Metadata } from "next";
import { FAQ_CLAIMS } from "@/lib/honest-claims";

/** Dominio canónico de producción (App Hosting). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://notificas.com.ar"
).replace(/\/$/, "");

export const SITE_NAME = "Notificas";
export const SITE_LEGAL_NAME = "Notificas SRL";
export const SITE_TAGLINE =
  "Notificaciones fehacientes digitales con certificación en blockchain";

export const DEFAULT_TITLE =
  "Notificas | Notificaciones fehacientes digitales certificadas en blockchain";

export const DEFAULT_DESCRIPTION =
  "Enviá un mensaje y dejá constancia de qué salió, a quién y cuándo. El certificado de lectura se emite una sola vez. Campañas de volumen por WhatsApp y correo, previa cotización.";

export const SITE_KEYWORDS = [
  "notificaciones fehacientes",
  "notificación fehaciente digital",
  "carta documento digital",
  "notificaciones certificadas",
  "notificación certificada online",
  "comunicación fehaciente",
  "intimación digital",
  "certificado blockchain",
  "Polygon",
  "prueba de envío",
  "prueba de lectura",
  "notificaciones legales Argentina",
  "Notificas",
  "notificaciones de alto volumen",
  "notificaciones WhatsApp empresas",
  "notificaciones por email",
  "notificaciones digitales certificadas",
  "notificaciones blockchain",
  "notificaciones masivas para empresas",
  "gestión de mora WhatsApp",
  "intimaciones digitales",
  "comunicaciones empresariales certificadas",
] as const;

export const SITE_CONTACT = {
  email: "contacto@notificas.com",
  phone: "+54-9-336-464-5357",
  phoneDisplay: "+54 9 336 464-5357",
  address: {
    streetAddress: "Colón 12, primer piso",
    addressLocality: "San Nicolás de los Arroyos",
    addressRegion: "Buenos Aires",
    addressCountry: "AR",
  },
  cuit: "33-71729868-9",
} as const;

/** Fecha real de la última revisión de URLs públicas (no “ahora” en cada build). */
export const SITEMAP_LASTMOD = new Date("2026-08-25T00:00:00.000Z");

export const SEO_GUIDE_PAGES = [
  {
    path: "/notificacion-fehaciente-digital",
    title: "Qué es una notificación fehaciente digital",
    description:
      "Qué deja constancia Notificas, qué no prueba un correo aceptado y cómo se usa un certificado de lectura en Argentina.",
    blurb: "Qué se registra, qué no, y cómo usarlo.",
  },
  {
    path: "/carta-documento-digital",
    title: "Carta documento digital: qué cubre Notificas y qué no",
    description:
      "Notificas no reemplaza una carta documento si la ley pide esa forma. Compará costos, plazos y valor de la constancia técnica.",
    blurb: "No reemplaza la carta documento. Sí deja rastro comprobable.",
  },
  {
    path: "/notificaciones-whatsapp-empresas",
    title: "Notificaciones por WhatsApp para empresas",
    description:
      "Campañas de volumen por WhatsApp Business: plantillas de Meta, qué se certifica y cómo se cotizan los envíos masivos.",
    blurb: "Plantillas de Meta, trazabilidad y campañas de volumen.",
  },
  {
    path: "/como-verificar-certificado",
    title: "Cómo verificar un certificado de Notificas",
    description:
      "Subí el PDF o ingresá el ID en notificas.com.ar/verify. Comparamos la huella del archivo con el registro en Polygon.",
    blurb: "Validá un PDF o un ID contra Polygon.",
  },
] as const;

export type SeoGuidePath = (typeof SEO_GUIDE_PAGES)[number]["path"];

export function getSeoGuide(path: SeoGuidePath) {
  const page = SEO_GUIDE_PAGES.find((item) => item.path === path);
  if (!page) throw new Error(`SEO guide missing: ${path}`);
  return page;
}

/** FAQs en texto plano para Schema.org FAQPage (sin JSX). */
export const FAQ_SEO_ITEMS = FAQ_CLAIMS;

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
  /** Si se omite, Next usa `opengraph-image.tsx` / `twitter-image.tsx` del app router. */
  ogImage?: string;
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords,
  noIndex = false,
  ogImage,
}: PageMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = ogImage ? absoluteUrl(ogImage) : undefined;

  return {
    title,
    description,
    keywords: keywords?.length ? [...keywords] : undefined,
    alternates: {
      canonical: url,
      languages: {
        "es-AR": url,
        es: url,
        "x-default": url,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "es_AR",
      type: "website",
      ...(imageUrl
        ? {
            images: [
              {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    robots: noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
  };
}

export const NO_INDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

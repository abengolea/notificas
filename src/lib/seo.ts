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

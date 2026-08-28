import type { Metadata } from "next";
import { FAQ_CLAIMS } from "@/lib/honest-claims";
import {
  GEO_LANDING_PAGES,
  LEGAL_PUBLIC_PAGES,
  RESOURCE_HUB,
  SEO_GUIDE_PAGES,
  type SeoGuidePath,
} from "@/lib/public-resources";

/** Dominio canónico de producción (App Hosting). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://notificas.com.ar"
).replace(/\/$/, "");

export const SITE_NAME = "Notificas";
export const SITE_LEGAL_NAME = "Notificas SRL";

/** Frase base de posicionamiento (variar la redacción en cada página). */
export const SITE_POSITIONING =
  "Notificas es una plataforma de comunicaciones digitales verificables por WhatsApp y email que permite a empresas y profesionales generar y preservar evidencia técnica sobre las distintas etapas de una comunicación.";

export const SITE_TAGLINE =
  "Comunicaciones digitales verificables por WhatsApp y email";

export const DEFAULT_TITLE =
  "Notificas | Comunicaciones digitales verificables por WhatsApp y email";

export const DEFAULT_DESCRIPTION =
  "Plataforma argentina para comunicaciones digitales verificables por WhatsApp y email, con evidencia técnica, trazabilidad de eventos y verificación pública de constancias.";

export const SITE_KEYWORDS = [
  "comunicaciones digitales verificables",
  "notificación WhatsApp",
  "notificar por WhatsApp",
  "WhatsApp como prueba",
  "intimación de deuda WhatsApp",
  "notificaciones masivas empresas",
  "email verificable",
  "notificación digital vs carta documento",
  "notificaciones fehacientes",
  "notificación fehaciente digital",
  "constancia de envío digital",
  "trazabilidad de comunicaciones",
  "evidencia de WhatsApp",
  "Notificas",
  "notificaciones WhatsApp empresas",
  "notificaciones por email",
  "intimaciones digitales",
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

export const CONTENT_EDITOR = SITE_LEGAL_NAME;

/** Fecha real de la última revisión de URLs públicas (no “ahora” en cada build). */
export const SITEMAP_LASTMOD = new Date("2026-08-27T00:00:00.000Z");
export const CONTENT_UPDATED_ON = "2026-08-27";
export const CONTENT_UPDATED_LABEL = "27 de agosto de 2026";

export { GEO_LANDING_PAGES, LEGAL_PUBLIC_PAGES, RESOURCE_HUB, SEO_GUIDE_PAGES };
export type { GeoLandingPath, SeoGuidePath } from "@/lib/public-resources";

export function getSeoGuide(path: SeoGuidePath) {
  const page = SEO_GUIDE_PAGES.find((item) => item.path === path);
  if (!page) throw new Error(`SEO guide missing: ${path}`);
  return page;
}

export function getGeoLanding(path: (typeof GEO_LANDING_PAGES)[number]["path"]) {
  const page = GEO_LANDING_PAGES.find((item) => item.path === path);
  if (!page) throw new Error(`GEO landing missing: ${path}`);
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
  ogType?: "website" | "article";
  updatedAt?: string;
  /** Si se omite, Next usa `opengraph-image.tsx` / `twitter-image.tsx` del app router. */
  ogImage?: string;
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords,
  noIndex = false,
  ogType = "website",
  updatedAt,
  ogImage,
}: PageMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = ogImage ? absoluteUrl(ogImage) : undefined;
  const modified = updatedAt ?? CONTENT_UPDATED_ON;
  const ogImages = imageUrl
    ? [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
        },
      ]
    : undefined;
  const openGraph =
    ogType === "article"
      ? {
          title,
          description,
          url,
          siteName: SITE_NAME,
          locale: "es_AR" as const,
          type: "article" as const,
          publishedTime: `${modified}T00:00:00.000Z`,
          modifiedTime: `${modified}T00:00:00.000Z`,
          authors: [CONTENT_EDITOR],
          ...(ogImages ? { images: ogImages } : {}),
        }
      : {
          title,
          description,
          url,
          siteName: SITE_NAME,
          locale: "es_AR" as const,
          type: "website" as const,
          ...(ogImages ? { images: ogImages } : {}),
        };

  return {
    title,
    description,
    keywords: keywords?.length ? [...keywords] : undefined,
    authors: [{ name: CONTENT_EDITOR, url: SITE_URL }],
    alternates: {
      canonical: url,
      languages: {
        "es-AR": url,
        es: url,
        "x-default": url,
      },
    },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    robots: noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : {
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

export const NO_INDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

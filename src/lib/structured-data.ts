import {
  FAQ_SEO_ITEMS,
  SITE_CONTACT,
  SITE_LEGAL_NAME,
  SITE_NAME,
  SITE_POSITIONING,
  SITE_URL,
  CONTENT_UPDATED_ON,
  absoluteUrl,
} from "@/lib/seo";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: SITE_LEGAL_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/notificasLogo.jpg"),
    image: absoluteUrl("/notificasLogo.jpg"),
    email: SITE_CONTACT.email,
    telephone: SITE_CONTACT.phone,
    taxID: SITE_CONTACT.cuit,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE_CONTACT.address.streetAddress,
      addressLocality: SITE_CONTACT.address.addressLocality,
      addressRegion: SITE_CONTACT.address.addressRegion,
      addressCountry: SITE_CONTACT.address.addressCountry,
    },
    areaServed: {
      "@type": "Country",
      name: "Argentina",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SITE_CONTACT.email,
        telephone: SITE_CONTACT.phone,
        availableLanguage: ["Spanish"],
        areaServed: "AR",
      },
    ],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_POSITIONING,
    inLanguage: "es-AR",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/verify?id={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_POSITIONING,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "es-AR",
    provider: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    areaServed: {
      "@type": "Country",
      name: "Argentina",
    },
    featureList: [
      "Comunicaciones por WhatsApp Business",
      "Comunicaciones por email",
      "Preservación de evidencia técnica y trazabilidad de eventos",
      "Verificación pública de constancias",
    ],
  };
}

export function serviceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE_URL}/#service`,
    name: "Comunicaciones digitales verificables",
    serviceType: "Comunicación digital verificable por WhatsApp y email",
    description: SITE_POSITIONING,
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: {
      "@type": "Country",
      name: "Argentina",
    },
    url: SITE_URL,
    termsOfService: absoluteUrl("/terminos"),
  };
}

export function articleJsonLd(opts: {
  title: string;
  description: string;
  path: string;
  dateModified?: string;
}) {
  const url = absoluteUrl(opts.path);
  const day = opts.dateModified ?? CONTENT_UPDATED_ON;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    inLanguage: "es-AR",
    datePublished: day,
    dateModified: day,
    mainEntityOfPage: url,
    url,
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function faqPageJsonLd(
  items: ReadonlyArray<{ question: string; answer: string }> = FAQ_SEO_ITEMS
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

export function breadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

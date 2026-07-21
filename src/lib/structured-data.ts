import {
  FAQ_SEO_ITEMS,
  SITE_CONTACT,
  SITE_LEGAL_NAME,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
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
    description: SITE_TAGLINE,
    inLanguage: "es-AR",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function serviceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE_URL}/#service`,
    name: "Notificaciones fehacientes digitales",
    serviceType: "Notificación fehaciente digital certificada en blockchain",
    description:
      "Plataforma para enviar notificaciones fehacientes digitales con certificación de envío, recepción y lectura en la red Polygon, con certificado PDF de valor probatorio.",
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: {
      "@type": "Country",
      name: "Argentina",
    },
    url: SITE_URL,
    offers: {
      "@type": "Offer",
      url: absoluteUrl("/signup"),
      availability: "https://schema.org/InStock",
      priceCurrency: "ARS",
    },
  };
}

export function faqPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    mainEntity: FAQ_SEO_ITEMS.map((item) => ({
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

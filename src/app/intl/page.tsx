import type { Metadata } from "next";
import { headers } from "next/headers";

import { InternationalLanding } from "@/components/international-landing";
import {
  INTERNATIONAL_DESCRIPTION,
  INTERNATIONAL_ORIGIN,
  INTERNATIONAL_TITLE,
  hostnameFromRequestHeaders,
  isInternationalHost,
} from "@/lib/international-site";

export async function generateMetadata(): Promise<Metadata> {
  const host = hostnameFromRequestHeaders(await headers());
  const onCom = isInternationalHost(host);

  return {
    metadataBase: new URL(INTERNATIONAL_ORIGIN),
    title: { absolute: INTERNATIONAL_TITLE },
    description: INTERNATIONAL_DESCRIPTION,
    applicationName: "Notificas",
    alternates: {
      canonical: INTERNATIONAL_ORIGIN,
      languages: {
        es: INTERNATIONAL_ORIGIN,
        "pt-BR": INTERNATIONAL_ORIGIN,
        "x-default": INTERNATIONAL_ORIGIN,
      },
    },
    openGraph: {
      type: "website",
      locale: "es_LA",
      url: INTERNATIONAL_ORIGIN,
      siteName: "Notificas",
      title: INTERNATIONAL_TITLE,
      description: INTERNATIONAL_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: INTERNATIONAL_TITLE,
      description: INTERNATIONAL_DESCRIPTION,
    },
    robots: onCom
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default function InternationalPreviewPage() {
  return <InternationalLanding />;
}

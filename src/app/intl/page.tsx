import type { Metadata } from "next";
import { headers } from "next/headers";

import { InternationalLanding } from "@/components/international-landing";
import {
  INTERNATIONAL_ORIGIN,
  isInternationalHost,
} from "@/lib/international-site";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";
  const onCom = isInternationalHost(host);

  return {
    title: { absolute: "Notificas | Comunicaciones digitales verificables" },
    description:
      "Comunicaciones digitales verificables por WhatsApp y email. Argentina está online. Brasil y Colombia, pronto.",
    alternates: {
      canonical: INTERNATIONAL_ORIGIN,
      languages: {
        es: INTERNATIONAL_ORIGIN,
        "pt-BR": INTERNATIONAL_ORIGIN,
        "x-default": INTERNATIONAL_ORIGIN,
      },
    },
    openGraph: {
      locale: "es_LA",
      url: INTERNATIONAL_ORIGIN,
      siteName: "Notificas",
      title: "Notificas | Comunicaciones digitales verificables",
      description:
        "Comunicaciones digitales verificables por WhatsApp y email. Argentina está online. Brasil y Colombia, pronto.",
    },
    robots: onCom
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default function InternationalPreviewPage() {
  return <InternationalLanding />;
}

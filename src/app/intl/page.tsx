import type { Metadata } from "next";
import { headers } from "next/headers";

import { InternationalLanding } from "@/components/international-landing";
import {
  hostnameFromRequestHeaders,
  internationalLandingMetadata,
  isInternationalHost,
} from "@/lib/international-site";

export async function generateMetadata(): Promise<Metadata> {
  const host = hostnameFromRequestHeaders(await headers());
  return internationalLandingMetadata(isInternationalHost(host));
}

export default function InternationalPreviewPage() {
  return <InternationalLanding />;
}

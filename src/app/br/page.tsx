import type { Metadata } from "next";

import { BrazilLanding } from "@/components/br/brazil-landing";
import { brazilLandingMetadata } from "@/lib/brazil-site";

export const metadata: Metadata = brazilLandingMetadata();

export default function BrazilLandingPage() {
  return <BrazilLanding />;
}

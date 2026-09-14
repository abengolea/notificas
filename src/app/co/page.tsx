import type { Metadata } from "next";

import { ColombiaLanding } from "@/components/co/colombia-landing";
import { colombiaLandingMetadata } from "@/lib/colombia-site";

export const metadata: Metadata = colombiaLandingMetadata();

export default function ColombiaLandingPage() {
  return <ColombiaLanding />;
}

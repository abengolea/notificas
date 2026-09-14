import type { Metadata } from "next";

import { BrazilVerify } from "@/components/br/brazil-verify";
import { brazilVerifyMetadata } from "@/lib/brazil-site";

export const metadata: Metadata = brazilVerifyMetadata();

export default function BrazilVerifyPage() {
  return <BrazilVerify />;
}

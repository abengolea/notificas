import type { Metadata } from "next";
import { EmpresaAuthGate } from "@/components/empresa/empresa-auth-gate";
import { NO_INDEX_METADATA } from "@/lib/seo";

export const metadata: Metadata = {
  ...NO_INDEX_METADATA,
  title: "Empresa",
};

export default function EmpresaRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmpresaAuthGate>{children}</EmpresaAuthGate>;
}

import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { createPageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = createPageMetadata({
  title: "Verificar certificado",
  description:
    "Verificá la autenticidad de un certificado PDF emitido por Notificas comparando su hash con el registro en Polygon.",
  path: "/verify",
  keywords: [
    "verificar certificado Notificas",
    "autenticidad certificado PDF",
    "verificación blockchain Polygon",
  ],
});

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Verificar certificado", path: "/verify" },
        ])}
      />
      {children}
    </>
  );
}

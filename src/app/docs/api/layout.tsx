import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API pública",
  description: "Documentación OpenAPI de la API v1 de Notificas.",
};

export default function PublicApiDocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

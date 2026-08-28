import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/require-admin-page";
import { NO_INDEX_METADATA } from "@/lib/seo";

export const metadata: Metadata = {
  ...NO_INDEX_METADATA,
  title: "API (admin)",
  description: "Documentación OpenAPI de la API v1. Solo visible para administradores.",
};

export default async function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return children;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NO_INDEX_METADATA } from "@/lib/seo";

export const metadata: Metadata = NO_INDEX_METADATA;

/**
 * Herramienta de desarrollo: autocompleta la clave `k` del mensaje y arma el enlace del lector.
 * En producción esa clave le serviría a cualquiera con acceso al documento para entrar al lector
 * como si fuera el destinatario, así que la página no existe fuera de desarrollo.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}

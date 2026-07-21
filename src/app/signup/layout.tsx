import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Crear cuenta",
  description:
    "Registrate en Notificas y empezá a enviar notificaciones fehacientes digitales certificadas en blockchain.",
  path: "/signup",
  keywords: [
    "registro Notificas",
    "crear cuenta notificaciones fehacientes",
    "alta Notificas",
  ],
});

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

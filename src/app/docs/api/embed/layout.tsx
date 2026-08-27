import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Insertar la API en tu web",
  description:
    "SDK y widget para disparar notificaciones certificadas desde tu sitio. La API key queda en tu servidor; el navegador habla con un proxy.",
  path: "/docs/api/embed",
});

export default function EmbedApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}

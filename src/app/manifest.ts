import type { MetadataRoute } from "next";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    lang: "es-AR",
    categories: ["business", "productivity", "legal"],
    icons: [
      {
        src: "/notificasLogo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/icon.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Verificar certificado",
        short_name: "Verificar",
        description: SITE_TAGLINE,
        url: "/verify",
      },
      {
        name: "Crear cuenta",
        short_name: "Registro",
        url: "/signup",
      },
    ],
  };
}

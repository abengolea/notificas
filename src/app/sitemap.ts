import type { MetadataRoute } from "next";
import { SEO_GUIDE_PAGES, SITE_URL, SITEMAP_LASTMOD } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/verify", changeFrequency: "monthly", priority: 0.9 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.85 },
    ...SEO_GUIDE_PAGES.map((page) => ({
      path: page.path,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { path: "/consumidores", changeFrequency: "yearly", priority: 0.5 },
    { path: "/terminos", changeFrequency: "yearly", priority: 0.4 },
    { path: "/privacidad", changeFrequency: "yearly", priority: 0.4 },
    { path: "/arrepentimiento", changeFrequency: "yearly", priority: 0.4 },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path === "/" ? "" : route.path}`,
    lastModified: SITEMAP_LASTMOD,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

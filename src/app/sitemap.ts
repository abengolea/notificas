import type { MetadataRoute } from "next";
import {
  GEO_LANDING_PAGES,
  LEGAL_PUBLIC_PAGES,
  RESOURCE_HUB,
  SEO_GUIDE_PAGES,
} from "@/lib/public-resources";
import { SITE_URL, SITEMAP_LASTMOD } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/verify", changeFrequency: "monthly", priority: 0.9 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.85 },
    { path: "/docs/api", changeFrequency: "monthly", priority: 0.7 },
    { path: "/docs/api/embed", changeFrequency: "monthly", priority: 0.7 },
    {
      path: RESOURCE_HUB.path,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    ...GEO_LANDING_PAGES.map((page) => ({
      path: page.path,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
    ...SEO_GUIDE_PAGES.map((page) => ({
      path: page.path,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...LEGAL_PUBLIC_PAGES.map((page) => ({
      path: page.path,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path === "/" ? "" : route.path}`,
    lastModified: SITEMAP_LASTMOD,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

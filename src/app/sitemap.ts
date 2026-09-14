import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import {
  BRAZIL_PATH,
  BRAZIL_PRE_NEGATIVACAO_PATH,
  BRAZIL_SITEMAP_LASTMOD,
} from "@/lib/brazil-site";
import {
  INTERNATIONAL_ORIGIN,
  hostnameFromRequestHeaders,
  isInternationalHost,
} from "@/lib/international-site";
import {
  GEO_LANDING_PAGES,
  LEGAL_PUBLIC_PAGES,
  RESOURCE_HUB,
  SEO_GUIDE_PAGES,
} from "@/lib/public-resources";
import { SITE_URL, SITEMAP_LASTMOD } from "@/lib/seo";

export function buildSitemap(origin: string = SITE_URL): MetadataRoute.Sitemap {
  const brazilPages: MetadataRoute.Sitemap = [
    {
      url: `${INTERNATIONAL_ORIGIN}${BRAZIL_PATH}`,
      lastModified: BRAZIL_SITEMAP_LASTMOD,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${INTERNATIONAL_ORIGIN}${BRAZIL_PRE_NEGATIVACAO_PATH}`,
      lastModified: BRAZIL_SITEMAP_LASTMOD,
      changeFrequency: "monthly",
      priority: 0.85,
    },
  ];

  if (origin === INTERNATIONAL_ORIGIN) {
    return [
      {
        url: INTERNATIONAL_ORIGIN,
        lastModified: SITEMAP_LASTMOD,
        changeFrequency: "weekly",
        priority: 1,
      },
      ...brazilPages,
    ];
  }

  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/verify", changeFrequency: "monthly", priority: 0.9 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.85 },
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
    url: `${origin}${route.path === "/" ? "" : route.path}`,
    lastModified: SITEMAP_LASTMOD,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = hostnameFromRequestHeaders(await headers());
  if (isInternationalHost(host)) return buildSitemap(INTERNATIONAL_ORIGIN);
  return buildSitemap(SITE_URL);
}

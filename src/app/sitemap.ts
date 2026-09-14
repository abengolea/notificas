import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import {
  BRAZIL_PATH,
  BRAZIL_PRE_NEGATIVACAO_PATH,
  BRAZIL_SITEMAP_LASTMOD,
  BRAZIL_VERIFY_PATH,
} from "@/lib/brazil-site";
import {
  COLOMBIA_COOKIES_PATH,
  COLOMBIA_FRAMEWORK_PATH,
  COLOMBIA_PATH,
  COLOMBIA_PRIVACY_PATH,
  COLOMBIA_SITEMAP_LASTMOD,
  COLOMBIA_TERMS_PATH,
} from "@/lib/colombia-site";
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
    {
      url: `${INTERNATIONAL_ORIGIN}${BRAZIL_VERIFY_PATH}`,
      lastModified: BRAZIL_SITEMAP_LASTMOD,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const colombiaPages: MetadataRoute.Sitemap = [
    {
      url: `${INTERNATIONAL_ORIGIN}${COLOMBIA_PATH}`,
      lastModified: COLOMBIA_SITEMAP_LASTMOD,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${INTERNATIONAL_ORIGIN}${COLOMBIA_PRIVACY_PATH}`,
      lastModified: COLOMBIA_SITEMAP_LASTMOD,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${INTERNATIONAL_ORIGIN}${COLOMBIA_COOKIES_PATH}`,
      lastModified: COLOMBIA_SITEMAP_LASTMOD,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${INTERNATIONAL_ORIGIN}${COLOMBIA_TERMS_PATH}`,
      lastModified: COLOMBIA_SITEMAP_LASTMOD,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${INTERNATIONAL_ORIGIN}${COLOMBIA_FRAMEWORK_PATH}`,
      lastModified: COLOMBIA_SITEMAP_LASTMOD,
      changeFrequency: "monthly",
      priority: 0.7,
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
      ...colombiaPages,
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

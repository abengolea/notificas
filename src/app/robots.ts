import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import {
  hostnameFromRequestHeaders,
  publicOriginFromHost,
} from "@/lib/international-site";
import {
  PRIVATE_PATH_PREFIXES,
  SEARCH_RETRIEVAL_USER_AGENTS,
  TRAINING_USER_AGENTS,
} from "@/lib/robots-policy";
import { SITE_URL } from "@/lib/seo";

const publicDisallow = [...PRIVATE_PATH_PREFIXES];

export function buildRobots(origin: string = SITE_URL): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: publicDisallow,
      },
      ...SEARCH_RETRIEVAL_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: publicDisallow,
      })),
      ...TRAINING_USER_AGENTS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = hostnameFromRequestHeaders(await headers());
  return buildRobots(publicOriginFromHost(host));
}

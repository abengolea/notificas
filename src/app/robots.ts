import type { MetadataRoute } from "next";
import {
  PRIVATE_PATH_PREFIXES,
  SEARCH_RETRIEVAL_USER_AGENTS,
  TRAINING_USER_AGENTS,
} from "@/lib/robots-policy";
import { SITE_URL } from "@/lib/seo";

const publicDisallow = [...PRIVATE_PATH_PREFIXES];

export default function robots(): MetadataRoute.Robots {
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
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

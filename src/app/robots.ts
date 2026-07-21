import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/empresa/",
          "/cuenta/",
          "/reader/",
          "/pdf-viewer/",
          "/process-payment/",
          "/email-preview/",
          "/test-firestore/",
          "/test-polygon/",
          "/test-reader/",
          "/linkRedirect",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/verify", changeFrequency: "monthly", priority: 0.9 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.85 },
    { path: "/login", changeFrequency: "monthly", priority: 0.6 },
    { path: "/consumidores", changeFrequency: "yearly", priority: 0.5 },
    { path: "/terminos", changeFrequency: "yearly", priority: 0.4 },
    { path: "/privacidad", changeFrequency: "yearly", priority: 0.4 },
    { path: "/arrepentimiento", changeFrequency: "yearly", priority: 0.4 },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

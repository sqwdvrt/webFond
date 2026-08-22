import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = siteConfig.routes.public;
  return routes.map((route) => ({ url: new URL(route, siteConfig.siteUrl).toString(), changeFrequency: "monthly", priority: route === "/" ? 1 : 0.7 }));
}

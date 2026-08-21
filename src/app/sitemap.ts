import type { MetadataRoute } from "next";
import { projects } from "@/content/projects";
import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [...siteConfig.routes.public, ...projects.map((project) => project.href)];
  return routes.map((route) => ({ url: new URL(route, siteConfig.siteUrl).toString(), changeFrequency: "monthly", priority: route === "/" ? 1 : 0.7 }));
}

import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import {
  listSitemapDocuments,
  listSitemapNews,
  listSitemapProjects,
} from "@/features/content-admin/sitemap-repository";

export const dynamic = "force-dynamic";

type SitemapDependencies = {
  listProjects: () => Promise<Array<{ slug: string }>>;
  listNews: () => Promise<Array<{ slug: string }>>;
  listDocuments: () => Promise<Array<{ id: string }>>;
};

const defaultDependencies: SitemapDependencies = {
  listProjects: listSitemapProjects,
  listNews: listSitemapNews,
  listDocuments: listSitemapDocuments,
};

function sitemapEntry(route: string): MetadataRoute.Sitemap[number] {
  return {
    url: new URL(route, siteConfig.siteUrl).toString(),
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.7,
  };
}

function staticEntries() {
  return siteConfig.routes.public.map(sitemapEntry);
}

export default async function sitemap(
  dependencies: SitemapDependencies = defaultDependencies,
): Promise<MetadataRoute.Sitemap> {
  let projects: Array<{ slug: string }>;
  let news: Array<{ slug: string }>;
  let documents: Array<{ id: string }>;

  try {
    [projects, news, documents] = await Promise.all([
      dependencies.listProjects(),
      dependencies.listNews(),
      dependencies.listDocuments(),
    ]);
  } catch {
    return staticEntries();
  }

  const dynamicRoutes = new Set<string>();
  for (const project of projects) dynamicRoutes.add(`/projects/${project.slug}`);
  if (news.length > 0) dynamicRoutes.add("/news");
  for (const post of news) dynamicRoutes.add(`/news/${post.slug}`);
  if (documents.length > 0) dynamicRoutes.add("/reports");

  return [
    ...staticEntries(),
    ...Array.from(dynamicRoutes).sort().map(sitemapEntry),
  ];
}

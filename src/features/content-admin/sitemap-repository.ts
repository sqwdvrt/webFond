import { prisma } from "@/lib/db";

type SlugRow = { slug: string };
type SlugDelegate = {
  findMany(args: { where: { status: "PUBLISHED" }; select: { slug: true } }): Promise<SlugRow[]>;
};
type DocumentDelegate = {
  findFirst(args: { where: { status: "PUBLISHED" }; select: { id: true } }): Promise<{ id: string } | null>;
};

export function listSitemapProjects(client: { project: SlugDelegate } = prisma) {
  return client.project.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
}

export function listSitemapNews(client: { newsPost: SlugDelegate } = prisma) {
  return client.newsPost.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
}

// Keep the collection-shaped dependency used by the sitemap; only existence matters.
export async function listSitemapDocuments(client: { document: DocumentDelegate } = prisma) {
  const document = await client.document.findFirst({ where: { status: "PUBLISHED" }, select: { id: true } });
  return document ? [document] : [];
}

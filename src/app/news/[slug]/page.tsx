import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/content/page-hero";
import { PublishedDetail } from "@/components/content/published-content";
import { getPublishedNewsPostForRequest } from "@/features/content-admin/public-loaders";

type NewsDetailProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: NewsDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const newsPost = await getPublishedNewsPostForRequest(slug);

  if (!newsPost) return {};

  return {
    title: newsPost.title,
    description: newsPost.summary,
    alternates: { canonical: `/news/${newsPost.slug}` },
  };
}

export default async function NewsDetailPage({ params }: NewsDetailProps) {
  const { slug } = await params;
  const newsPost = await getPublishedNewsPostForRequest(slug);

  if (!newsPost) notFound();

  return (
    <>
      <PageHero eyebrow="Новости" title={newsPost.title} description={newsPost.summary ?? ""} />
      <PublishedDetail
        content={newsPost.content ?? ""}
        imageUrl={newsPost.imageUrl}
        publishedAt={newsPost.publishedAt}
        title={newsPost.title}
      />
    </>
  );
}

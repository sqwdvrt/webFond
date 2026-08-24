import type { Metadata } from "next";

import { EmptyState } from "@/components/content/empty-state";
import { PageHero } from "@/components/content/page-hero";
import { PublishedCard } from "@/components/content/published-content";
import { listPublishedNewsForRequest } from "@/features/content-admin/public-loaders";
import type { PublicEditorialListRow } from "@/features/content-admin/repository";

export const dynamic = "force-dynamic";

type NewsPageDependencies = {
  listNews: () => Promise<PublicEditorialListRow[]>;
};

const defaultDependencies: NewsPageDependencies = {
  listNews: listPublishedNewsForRequest,
};

const baseMetadata = {
  title: "Новости",
  description: "Новости фонда «Быть Добру».",
};

export async function generateNewsMetadata(
  dependencies: NewsPageDependencies = defaultDependencies,
): Promise<Metadata> {
  try {
    const news = await dependencies.listNews();
    if (news.length > 0) {
      return {
        ...baseMetadata,
        alternates: { canonical: "/news" },
        robots: { index: true, follow: true },
      };
    }
  } catch {
    // Collection failures remain non-indexable, like the honest empty state.
  }

  return {
    ...baseMetadata,
    robots: { index: false, follow: true },
  };
}

export function generateMetadata() {
  return generateNewsMetadata();
}

export async function renderNewsPage(
  dependencies: NewsPageDependencies = defaultDependencies,
) {
  let publishedNews: PublicEditorialListRow[] | null;

  try {
    publishedNews = await dependencies.listNews();
  } catch {
    publishedNews = null;
  }

  return (
    <>
      <PageHero
        eyebrow="Новости"
        title="Новости фонда"
        description="Здесь появляются проверенные материалы о работе фонда."
      />
      <section className="page-section">
        <div className="container">
          {publishedNews === null ? (
            <p className="status-note" role="status">
              Новости временно недоступны. Попробуйте обновить страницу позже.
            </p>
          ) : publishedNews.length > 0 ? (
            <div className="published-grid">
              {publishedNews.map((newsPost) => (
                <PublishedCard
                  key={newsPost.id}
                  href={`/news/${newsPost.slug}`}
                  imageUrl={newsPost.imageUrl}
                  publishedAt={newsPost.publishedAt}
                  summary={newsPost.summary}
                  title={newsPost.title}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Материалы готовятся к публикации"
              description="Новости появятся после проверки и утверждения."
            />
          )}
        </div>
      </section>
    </>
  );
}

export default function NewsPage() {
  return renderNewsPage();
}

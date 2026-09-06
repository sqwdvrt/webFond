import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type PublishedImageProps = {
  imageUrl: string;
  title: string;
};

type PublishedCardProps = {
  href: string;
  imageUrl: string | null;
  publishedAt: Date | null;
  summary: string | null;
  title: string;
  headingLevel?: 2 | 3;
  children?: ReactNode;
};

const publicationDate = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeZone: "Europe/Moscow",
});

export function PublishedImage({ imageUrl, title }: PublishedImageProps) {
  const imageProps = {
    height: 405,
    width: 720,
  };

  return (
    <div className="published-image">
      {imageUrl.startsWith("/") ? (
        <Image alt={title} {...imageProps} src={imageUrl} sizes="(max-width: 720px) 100vw, 560px" />
      ) : (
        // External editorial images are loaded by the visitor's browser, not the Next image proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={title} {...imageProps} src={imageUrl} loading="lazy" decoding="async" />
      )}
    </div>
  );
}

export function PublishedCard({
  href,
  imageUrl,
  publishedAt,
  summary,
  title,
  headingLevel = 2,
  children,
}: PublishedCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";

  return (
    <article className="published-card">
      {imageUrl ? <PublishedImage imageUrl={imageUrl} title={title} /> : null}
      <div className="published-card-copy">
        {publishedAt ? (
          <time dateTime={publishedAt.toISOString()}>
            {publicationDate.format(publishedAt)}
          </time>
        ) : null}
        <Heading>
          <Link href={href}>{title}</Link>
        </Heading>
        {summary ? <p>{summary}</p> : null}
        {children}
      </div>
    </article>
  );
}

export function PublishedBody({ content }: { content: string }) {
  const paragraphs = content.split(/\n\s*\n/);

  return (
    <div className="published-body">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

export function PublishedDetail({
  content,
  imageUrl,
  publishedAt,
  title,
}: {
  content: string;
  imageUrl: string | null;
  publishedAt: Date | null;
  title: string;
}) {
  return (
    <section className="page-section">
      <div className="container published-detail">
        {imageUrl ? <PublishedImage imageUrl={imageUrl} title={title} /> : null}
        {publishedAt ? (
          <time dateTime={publishedAt.toISOString()}>
            {publicationDate.format(publishedAt)}
          </time>
        ) : null}
        <PublishedBody content={content} />
      </div>
    </section>
  );
}

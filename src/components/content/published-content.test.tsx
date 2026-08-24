import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PublishedBody,
  PublishedCard,
} from "@/components/content/published-content";

const publishedAt = new Date("2026-08-22T10:00:00.000Z");

describe("published content", () => {
  it("renders local images through Next Image with stable dimensions and a safe alt", () => {
    render(
      <PublishedCard
        href="/projects/local-project"
        imageUrl="/media/project.jpg"
        publishedAt={publishedAt}
        summary="Краткое описание проекта"
        title={'Проект <img src=x onerror="alert(1)">'}
      />,
    );

    const image = screen.getByRole("img", {
      name: 'Проект <img src=x onerror="alert(1)">',
    });
    expect(image).toHaveAttribute("width", "720");
    expect(image).toHaveAttribute("height", "405");
    expect(image).toHaveAttribute("src", expect.stringContaining("%2Fmedia%2Fproject.jpg"));
    expect(document.querySelector("img[onerror]")).not.toBeInTheDocument();
  });

  it("renders external images directly without a server image proxy", () => {
    render(
      <PublishedCard
        href="/news/external-image"
        imageUrl="https://media.example.org/news.jpg"
        publishedAt={publishedAt}
        summary="Краткое описание новости"
        title="Новость фонда"
      />,
    );

    expect(screen.getByRole("img", { name: "Новость фонда" })).toHaveAttribute(
      "src",
      "https://media.example.org/news.jpg",
    );
  });

  it("renders a linked card summary and a human-readable publication date", () => {
    render(
      <PublishedCard
        href="/news/published-news"
        imageUrl={null}
        publishedAt={publishedAt}
        summary="Проверенная новость фонда"
        title="Опубликованная новость"
      />,
    );

    expect(screen.getByRole("article")).toBeVisible();
    expect(screen.getByRole("link", { name: "Опубликованная новость" })).toHaveAttribute(
      "href",
      "/news/published-news",
    );
    expect(screen.getByText("Проверенная новость фонда")).toBeVisible();
    expect(screen.getByText("22 августа 2026 г.")).toHaveAttribute(
      "dateTime",
      publishedAt.toISOString(),
    );
  });

  it("preserves plain-text paragraphs without interpreting HTML", () => {
    const content = "Первый абзац\nс новой строкой.\n\n<script>alert('xss')</script>";
    const { container } = render(<PublishedBody content={content} />);

    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(screen.getByText(/Первый абзац\s+с новой строкой\./)).toBeVisible();
    expect(screen.getByText("<script>alert('xss')</script>")).toBeVisible();
    expect(container.querySelector("script")).not.toBeInTheDocument();

    const source = readFileSync(
      join(process.cwd(), "src/components/content/published-content.tsx"),
      "utf8",
    );
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("uses a responsive stable image frame", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const frame = css.match(/\.published-image\s*\{([^}]*)\}/)?.[1];

    expect(frame).toContain("aspect-ratio: 16 / 9");
    expect(frame).toContain("width: 100%");
    expect(frame).toContain("overflow: hidden");
  });
});

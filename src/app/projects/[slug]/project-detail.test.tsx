import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicEditorialDetailRow } from "@/features/content-admin/repository";

const mocks = vi.hoisted(() => ({
  getPublishedProject: vi.fn(),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/features/content-admin/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/content-admin/repository")>()),
  getPublishedProject: mocks.getPublishedProject,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import ProjectError from "@/app/projects/error";
import ProjectPage, { generateMetadata } from "@/app/projects/[slug]/page";

const project: PublicEditorialDetailRow = {
  id: "project-1",
  title: "Опубликованный проект",
  slug: "published-project",
  summary: "Проверенное описание опубликованного проекта.",
  content: "Первый абзац.\n\nВторой абзац.",
  imageUrl: "/media/project.jpg",
  publishedAt: new Date("2026-08-22T10:00:00.000Z"),
};

describe("published project detail", () => {
  beforeEach(() => {
    mocks.getPublishedProject.mockReset();
    mocks.notFound.mockClear();
  });

  it("awaits promised params and renders the published repository result", async () => {
    mocks.getPublishedProject.mockResolvedValue(project);

    render(await ProjectPage({ params: Promise.resolve({ slug: project.slug }) }));

    expect(mocks.getPublishedProject).toHaveBeenCalledExactlyOnceWith(project.slug);
    expect(screen.getByRole("heading", { level: 1, name: project.title })).toBeVisible();
    expect(screen.getByText(project.summary!)).toBeVisible();
    expect(screen.getByText("Первый абзац.")).toBeVisible();
    expect(screen.getByText("Второй абзац.")).toBeVisible();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("calls notFound only when the published repository returns null", async () => {
    mocks.getPublishedProject.mockResolvedValue(null);

    await expect(
      ProjectPage({ params: Promise.resolve({ slug: "draft-or-missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("propagates repository failures to the route error boundary", async () => {
    const failure = new Error("database unavailable");
    mocks.getPublishedProject.mockRejectedValue(failure);

    await expect(
      ProjectPage({ params: Promise.resolve({ slug: project.slug }) }),
    ).rejects.toBe(failure);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("generates published metadata with a canonical detail URL", async () => {
    mocks.getPublishedProject.mockResolvedValue(project);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: project.slug }) }),
    ).resolves.toEqual({
      title: project.title,
      description: project.summary,
      alternates: { canonical: `/projects/${project.slug}` },
    });
  });

  it("returns no metadata for an inaccessible entry", async () => {
    mocks.getPublishedProject.mockResolvedValue(null);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "archived" }) }),
    ).resolves.toEqual({});
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});

describe("project error boundary", () => {
  it("is a typed client component with neutral copy and retry", () => {
    const reset = vi.fn();
    render(<ProjectError error={new Error("private database detail")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Не удалось загрузить проект" })).toBeVisible();
    expect(screen.getByText("Попробуйте загрузить страницу еще раз.")).toBeVisible();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(reset).toHaveBeenCalledOnce();

    const source = readFileSync(
      join(process.cwd(), "src/app/projects/error.tsx"),
      "utf8",
    );
    expect(source.startsWith('"use client"')).toBe(true);
    expect(source).toMatch(/error:\s*Error\s*&\s*\{\s*digest\?:\s*string\s*\}/);
    expect(source).toMatch(/reset:\s*\(\)\s*=>\s*void/);
  });
});

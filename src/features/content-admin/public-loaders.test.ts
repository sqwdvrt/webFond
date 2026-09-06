import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cache: vi.fn(<T extends (...args: never[]) => unknown>(loader: T) => loader),
  getPublishedNewsPost: vi.fn(),
  getPublishedProjectForDisplay: vi.fn(),
  listPublishedNews: vi.fn(),
}));

vi.mock("react", () => ({ cache: mocks.cache }));
vi.mock("./repository", () => ({
  getPublishedNewsPost: mocks.getPublishedNewsPost,
  listPublishedNews: mocks.listPublishedNews,
}));
vi.mock("@/features/fundraising/public-projects", () => ({
  getPublishedProjectForDisplay: mocks.getPublishedProjectForDisplay,
}));

import {
  getPublishedNewsPostForRequest,
  getPublishedProjectForRequest,
  listPublishedNewsForRequest,
} from "./public-loaders";

describe("public request loaders", () => {
  it("wraps every duplicated production repository read in React.cache", () => {
    expect(mocks.cache).toHaveBeenCalledWith(mocks.listPublishedNews);
    expect(mocks.cache).toHaveBeenCalledWith(mocks.getPublishedProjectForDisplay);
    expect(mocks.cache).toHaveBeenCalledWith(mocks.getPublishedNewsPost);
    expect(listPublishedNewsForRequest).toBe(mocks.listPublishedNews);
    expect(getPublishedProjectForRequest).toBe(mocks.getPublishedProjectForDisplay);
    expect(getPublishedNewsPostForRequest).toBe(mocks.getPublishedNewsPost);
  });

  it("wires production metadata and pages to the request-cached loaders", () => {
    const sources = {
      newsCollection: readFileSync(join(process.cwd(), "src/app/news/page.tsx"), "utf8"),
      newsDetail: readFileSync(join(process.cwd(), "src/app/news/[slug]/page.tsx"), "utf8"),
      projectDetail: readFileSync(join(process.cwd(), "src/app/projects/[slug]/page.tsx"), "utf8"),
    };

    expect(sources.newsCollection).toContain("listPublishedNewsForRequest");
    expect(sources.newsDetail).toContain("getPublishedNewsPostForRequest");
    expect(sources.projectDetail).toContain("getPublishedProjectForRequest");
    expect(Object.values(sources).join("\n")).not.toMatch(
      /import\s*\{[^}]*\b(?:listPublishedNews|getPublishedNewsPost|getPublishedProject)\b[^}]*\}\s*from\s*["']@\/features\/content-admin\/repository["']/,
    );
  });
});

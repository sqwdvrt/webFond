import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata } from "@/app/layout";
import { metadata as homeMetadata } from "@/app/page";
import { metadata as aboutMetadata } from "@/app/about/page";
import { metadata as contactsMetadata } from "@/app/contacts/page";
import { metadata as helpMetadata } from "@/app/help/page";
import { metadata as projectsMetadata } from "@/app/projects/page";
import { metadata as requisitesMetadata } from "@/app/requisites/page";
import { generateNewsMetadata } from "@/app/news/page";
import { generateReportsMetadata } from "@/app/reports/page";
import { metadata as privacyMetadata } from "@/app/privacy/page";
import { metadata as consentMetadata } from "@/app/personal-data-consent/page";
import { metadata as offerMetadata } from "@/app/donation-offer/page";
import { metadata as cookiesMetadata } from "@/app/cookies/page";

describe("SEO routes", () => {
  it("sets site origin and a 1200 by 630 Open Graph image", () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL);
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: expect.any(String),
      },
    ]);
  });

  it("forces dynamic sitemap rendering so a caught database failure is not cached", () => {
    const source = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf8");

    expect(source).toContain('export const dynamic = "force-dynamic"');
  });

  it("returns stable absolute static, collection and published detail routes", async () => {
    const result = await sitemap({
      listProjects: async () => [
        { id: "project-z", title: "Z", slug: "z-project", summary: null, imageUrl: null, publishedAt: new Date("2026-08-23") },
        { id: "project-a", title: "A", slug: "a-project", summary: null, imageUrl: null, publishedAt: new Date("2026-08-22") },
      ],
      listNews: async () => [
        { id: "news-1", title: "News", slug: "published-news", summary: null, imageUrl: null, publishedAt: new Date("2026-08-23") },
      ],
      listDocuments: async () => [
        { id: "document-1", title: "Report", category: "Reports", fileUrl: "https://files.example.org/private-document", publishedAt: new Date("2026-08-23") },
      ],
    });
    const origin = metadata.metadataBase as URL;
    const baseUrls = [
      "/",
      "/about",
      "/help",
      "/projects",
      "/requisites",
      "/contacts",
      "/privacy",
      "/personal-data-consent",
      "/donation-offer",
      "/cookies",
    ].map((path) => new URL(path, origin).toString());
    const dynamicUrls = [
      "/news",
      "/news/published-news",
      "/projects/a-project",
      "/projects/z-project",
      "/reports",
    ].map((path) => new URL(path, origin).toString());

    expect(result.map((entry) => entry.url)).toEqual([...baseUrls, ...dynamicUrls]);
    expect(result.every((entry) => new URL(entry.url).origin === origin.origin)).toBe(true);
    expect(result.map((entry) => entry.url)).not.toEqual(expect.arrayContaining([
      new URL("/admin", origin).toString(),
      new URL("/projects/draft-project", origin).toString(),
      new URL("/news/archived-news", origin).toString(),
      "https://files.example.org/private-document",
    ]));
  });

  it("omits empty optional collections and returns only safe static routes on failure", async () => {
    const emptyDependencies = {
      listProjects: async () => [],
      listNews: async () => [],
      listDocuments: async () => [],
    };
    const baseUrls = [
      "/",
      "/about",
      "/help",
      "/projects",
      "/requisites",
      "/contacts",
      "/privacy",
      "/personal-data-consent",
      "/donation-offer",
      "/cookies",
    ].map((path) => new URL(path, metadata.metadataBase as URL).toString());

    await expect(sitemap(emptyDependencies)).resolves.toEqual(
      expect.arrayContaining(baseUrls.map((url) => expect.objectContaining({ url }))),
    );
    expect((await sitemap(emptyDependencies)).map((entry) => entry.url)).toEqual(baseUrls);

    const failure = new Error("database unavailable");
    const failed = await sitemap({
      ...emptyDependencies,
      listNews: async () => { throw failure; },
    });
    expect(failed.map((entry) => entry.url)).toEqual(baseUrls);
  });

  it("blocks service routes from crawlers", () => {
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] });
  });

  it("gives every indexable page unique metadata and a canonical URL", () => {
    const pages = [homeMetadata, aboutMetadata, helpMetadata, projectsMetadata, requisitesMetadata, contactsMetadata];
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
    for (const page of pages) {
      expect(page.title).toBeTruthy();
      expect(page.description).toBeTruthy();
      expect(page.alternates?.canonical).toBeTruthy();
    }
  });

  it("uses charter wording for the activities page metadata", () => {
    expect(projectsMetadata.title).toBe("Цели, предмет и виды деятельности фонда");
    expect(projectsMetadata.description).toBe("Виды деятельности фонда «Быть Добру» по уставу.");
    expect(projectsMetadata.alternates?.canonical).toBe("/projects");
  });

  it("keeps empty news and reports noindex", async () => {
    const newsMetadata = await generateNewsMetadata({ listNews: async () => [] });
    const reportsMetadata = await generateReportsMetadata({ listDocuments: async () => [] });
    for (const page of [newsMetadata, reportsMetadata]) {
      expect(page.robots).toEqual({ index: false, follow: true });
    }
  });

  it("indexes published legal documents", () => {
    for (const page of [privacyMetadata, consentMetadata, cookiesMetadata, offerMetadata]) {
      expect(page.title).toBeTruthy();
      expect(page.description).toBeTruthy();
      expect(page.robots).not.toEqual({ index: false, follow: true });
    }
    expect(privacyMetadata.alternates?.canonical).toBe("/privacy");
    expect(consentMetadata.alternates?.canonical).toBe("/personal-data-consent");
    expect(cookiesMetadata.alternates?.canonical).toBe("/cookies");
  });

  it("indexes the published donation offer", () => {
    expect(offerMetadata.title).toBe(
      "Публичная оферта о заключении договора пожертвования",
    );
    expect(offerMetadata.robots).not.toEqual({ index: false, follow: true });
  });

  it("gives populated optional collections canonical indexable metadata", async () => {
    const newsMetadata = await generateNewsMetadata({ listNews: async () => [
      { id: "news-1", title: "News", slug: "news", summary: null, imageUrl: null, publishedAt: new Date("2026-08-23") },
    ] });
    const reportsMetadata = await generateReportsMetadata({ listDocuments: async () => [
      { id: "document-1", title: "Report", category: "Reports", fileUrl: "/document", publishedAt: new Date("2026-08-23") },
    ] });

    expect(newsMetadata).toMatchObject({
      alternates: { canonical: "/news" },
      robots: { index: true, follow: true },
    });
    expect(reportsMetadata).toMatchObject({
      alternates: { canonical: "/reports" },
      robots: { index: true, follow: true },
    });
  });
});

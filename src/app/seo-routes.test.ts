import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata } from "@/app/layout";
import { metadata as homeMetadata } from "@/app/page";
import { metadata as aboutMetadata } from "@/app/about/page";
import { metadata as contactsMetadata } from "@/app/contacts/page";
import { metadata as helpMetadata } from "@/app/help/page";
import { metadata as projectsMetadata } from "@/app/projects/page";
import { generateMetadata as generateProjectMetadata } from "@/app/projects/[slug]/page";
import { metadata as requisitesMetadata } from "@/app/requisites/page";
import { metadata as newsMetadata } from "@/app/news/page";
import { metadata as reportsMetadata } from "@/app/reports/page";
import { metadata as privacyMetadata } from "@/app/privacy/page";
import { metadata as consentMetadata } from "@/app/personal-data-consent/page";
import { metadata as offerMetadata } from "@/app/donation-offer/page";
import { metadata as cookiesMetadata } from "@/app/cookies/page";
import { projects } from "@/content/projects";

describe("SEO routes", () => {
  it("sets site origin and Open Graph brand image", () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL);
    expect(metadata.openGraph?.images).toBeTruthy();
  });

  it("includes indexable routes and excludes placeholders", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const path of ["/", "/about", "/help", "/projects", "/requisites", "/contacts"]) {
      expect(urls).toContain(new URL(path, metadata.metadataBase as URL).toString());
    }
    for (const project of projects) expect(urls).toContain(new URL(project.href, metadata.metadataBase as URL).toString());
    expect(urls.some((url) => url.endsWith("/news"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/reports"))).toBe(false);
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

  it("builds project metadata from approved content", async () => {
    for (const project of projects) {
      const page = await generateProjectMetadata({ params: Promise.resolve({ slug: project.slug }) });
      expect(page.title).toBe(project.title);
      expect(page.description).toBe(project.description);
      expect(page.alternates?.canonical).toBe(project.href);
    }
  });

  it("keeps every placeholder route noindex", () => {
    for (const page of [newsMetadata, reportsMetadata, privacyMetadata, consentMetadata, offerMetadata, cookiesMetadata]) {
      expect(page.robots).toEqual({ index: false, follow: true });
    }
  });
});

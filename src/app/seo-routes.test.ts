import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata } from "@/app/layout";
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
});

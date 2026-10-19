import { afterEach, describe, expect, it, vi } from "vitest";

import { siteConfig } from "@/config/site";

describe("siteConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("contains the confirmed foundation identity", () => {
    expect(siteConfig.name).toBe("Фонд «Быть Добру»");
    expect(siteConfig.shortName).toBe("ФБД");
    expect(siteConfig.tagline).toBe("Делая мир лучше");
    expect(siteConfig.legal.ogrn).toBe("1257700318974");
    expect(siteConfig.legal.inn).toBe("9721254417");
  });

  it("exposes the main public sections and a dedicated help route", () => {
    expect(siteConfig.navigation.map((item) => item.href)).toEqual([
      "/about",
      "/projects",
      "/need-help",
      "/requisites",
      "/contacts",
    ]);
    expect(siteConfig.navigation.find((item) => item.href === "/projects")?.label).toBe("Деятельность");
    expect(siteConfig.helpHref).toBe("/help");
    expect(siteConfig.routes.contactsForHelp).toBe("/need-help");
    expect(siteConfig.legal.emailLabel).toBe("fbd_2025@mail.ru");
    expect(siteConfig.routes.public).toContain("/requisites");
    expect(siteConfig.routes.public).toContain("/need-help");
    expect(siteConfig.routes.public).toEqual(
      expect.arrayContaining([
        "/privacy",
        "/personal-data-consent",
        "/donation-offer",
        "/cookies",
      ]),
    );
  });

  it("uses the production site origin fallback when no override is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    vi.resetModules();
    const { siteConfig: config } = await import("@/config/site");
    expect(config.siteUrl).toBeInstanceOf(URL);
    expect(config.siteUrl.origin).toBe("https://fond-bit-dobru.ru");
    expect(config.foundedAt).toBe("2025-07-17");
  });

  it("uses the configured site origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.resetModules();
    const { siteConfig: config } = await import("@/config/site");
    expect(config.siteUrl.origin).toBe("http://localhost:3000");
  });
});

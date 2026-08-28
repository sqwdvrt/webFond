import { describe, expect, it } from "vitest";

import { siteConfig } from "@/config/site";

describe("siteConfig", () => {
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
      "/reports",
      "/news",
      "/contacts",
    ]);
    expect(siteConfig.navigation.find((item) => item.href === "/projects")?.label).toBe("Деятельность");
    expect(siteConfig.helpHref).toBe("/help");
    expect(siteConfig.routes.contactsForHelp).toBe("/contacts");
    expect(siteConfig.legal.emailLabel).toBe("sorovoi@mail.ru");
    expect(siteConfig.routes.public).toContain("/requisites");
    expect(siteConfig.routes.public).toEqual(
      expect.arrayContaining([
        "/privacy",
        "/personal-data-consent",
        "/donation-offer",
        "/cookies",
      ]),
    );
  });

  it("uses a valid local site origin fallback", () => {
    expect(siteConfig.siteUrl).toBeInstanceOf(URL);
    expect(siteConfig.siteUrl.origin).toMatch(/^https?:\/\//);
    expect(siteConfig.foundedAt).toBe("2025-07-17");
  });
});

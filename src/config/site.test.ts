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
    expect(siteConfig.helpHref).toBe("/help");
  });
});

import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

describe("admin response headers", () => {
  it("keeps every admin response private and non-referring", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();
    const admin = rules.find((rule) => rule.source === "/admin/:path*");

    expect(admin?.headers).toEqual([
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ]);
  });
});

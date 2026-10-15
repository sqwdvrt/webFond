import { describe, expect, it } from "vitest";

import { buildHeaders } from "../../../next.config";

const privacyHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const adminSecurityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

describe("admin response headers", () => {
  it("adds admin security headers without HSTS in development", () => {
    const rules = buildHeaders("development");
    const admin = rules.find((rule) => rule.source === "/admin/:path*");
    const donation = rules.find(
      (rule) => rule.source === "/donation/result",
    );
    const hstsHeaders = rules.flatMap((rule) =>
      rule.headers.filter(
        (header) => header.key === "Strict-Transport-Security",
      ),
    );

    expect(admin?.headers).toEqual([
      ...privacyHeaders,
      ...adminSecurityHeaders,
    ]);
    expect(donation?.headers).toEqual(privacyHeaders);
    expect(hstsHeaders).toEqual([]);
  });

  it("adds exactly one global HSTS rule in production", () => {
    const rules = buildHeaders("production");
    const hstsRules = rules.filter((rule) =>
      rule.headers.some(
        (header) => header.key === "Strict-Transport-Security",
      ),
    );

    expect(hstsRules).toEqual([
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ]);
  });
});

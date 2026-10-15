import type { NextConfig } from "next";

type ResponseHeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

export function buildHeaders(
  environment: string | undefined,
): ResponseHeaderRule[] {
  const rules: ResponseHeaderRule[] = [
    {
      source: "/admin/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-store, max-age=0",
        },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        {
          key: "Content-Security-Policy",
          value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
    {
      source: "/donation/result",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-store, max-age=0",
        },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    },
  ];

  if (environment === "production") {
    rules.push({
      source: "/:path*",
      headers: [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ],
    });
  }

  return rules;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return buildHeaders(process.env.NODE_ENV);
  },
};

export default nextConfig;

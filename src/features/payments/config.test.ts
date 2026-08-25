import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { DonationOfferPublication } from "@/content/donation-offer";
import {
  PaymentsConfigurationError,
  readPaymentCreateConfig,
  readPaymentsAvailability,
  readYooKassaConfig,
} from "@/features/payments/config";

const publishedOffer: DonationOfferPublication = {
  status: "published",
  version: "2026-08-24",
  title: "Оферта пожертвования",
  sections: [{ heading: "Условия", paragraphs: ["Проверенный текст"] }],
};

const baseEnv = {
  NODE_ENV: "test",
  PAYMENTS_ENABLED: "true",
  PAYMENTS_OFFER_VERSION: "2026-08-24",
  YOOKASSA_SHOP_ID: "shop-id",
  YOOKASSA_SECRET_KEY: "secret-key",
  SITE_URL: "http://localhost:3000",
  YOOKASSA_RETURN_URL: "http://localhost:3000/donation/result",
  PAYMENTS_RATE_LIMIT_SECRET: "r".repeat(32),
  PAYMENTS_TRUST_PROXY: "false",
} as const;

describe("readPaymentsAvailability", () => {
  it("is disabled by default", () => {
    expect(readPaymentsAvailability({}, publishedOffer)).toEqual({
      enabled: false,
    });
  });

  it.each(["TRUE", " true", "true "])(
    "requires the exact true boolean: %s",
    (PAYMENTS_ENABLED) => {
      expect(
        readPaymentsAvailability(
          {
            PAYMENTS_ENABLED,
            PAYMENTS_OFFER_VERSION: publishedOffer.version,
          },
          publishedOffer,
        ),
      ).toEqual({ enabled: false });
    },
  );

  it("uses only the legal gate and ignores payment credentials", () => {
    expect(
      readPaymentsAvailability(
        {
          PAYMENTS_ENABLED: "true",
          PAYMENTS_OFFER_VERSION: publishedOffer.version,
        },
        publishedOffer,
      ),
    ).toEqual({ enabled: true });
  });
});

describe("readYooKassaConfig", () => {
  it("trims required values without reading the create gate", () => {
    expect(
      readYooKassaConfig({
        PAYMENTS_ENABLED: "false",
        YOOKASSA_SHOP_ID: " shop-id ",
        YOOKASSA_SECRET_KEY: " secret-key ",
      }),
    ).toEqual({ shopId: "shop-id", secretKey: "secret-key" });
  });

  it.each([
    { YOOKASSA_SHOP_ID: " ", YOOKASSA_SECRET_KEY: "secret-key" },
    { YOOKASSA_SHOP_ID: "shop-id", YOOKASSA_SECRET_KEY: "\t" },
  ])("rejects missing credentials without exposing values", (env) => {
    expect(() => readYooKassaConfig(env)).toThrowError(
      PaymentsConfigurationError,
    );

    try {
      readYooKassaConfig(env);
    } catch (error) {
      expect(String(error)).not.toContain("shop-id");
      expect(String(error)).not.toContain("secret-key");
    }
  });
});

describe("readPaymentCreateConfig", () => {
  it("returns trimmed server-only create configuration", () => {
    expect(
      readPaymentCreateConfig(
        {
          ...baseEnv,
          YOOKASSA_SHOP_ID: " shop-id ",
          YOOKASSA_SECRET_KEY: " secret-key ",
          SITE_URL: " http://localhost:3000 ",
          YOOKASSA_RETURN_URL:
            " http://localhost:3000/donation/result ",
          PAYMENTS_RATE_LIMIT_SECRET: ` ${"r".repeat(32)} `,
        },
        publishedOffer,
      ),
    ).toEqual({
      shopId: "shop-id",
      secretKey: "secret-key",
      siteUrl: new URL("http://localhost:3000"),
      returnUrl: new URL("http://localhost:3000/donation/result"),
      rateLimitSecret: "r".repeat(32),
      trustProxy: false,
    });
  });

  it("rejects create configuration when the legal gate is disabled", () => {
    expect(() =>
      readPaymentCreateConfig(
        { ...baseEnv, PAYMENTS_ENABLED: "false" },
        publishedOffer,
      ),
    ).toThrowError(PaymentsConfigurationError);
  });

  it("requires a rate-limit secret of at least 32 characters", () => {
    expect(() =>
      readPaymentCreateConfig(
        { ...baseEnv, PAYMENTS_RATE_LIMIT_SECRET: "r".repeat(31) },
        publishedOffer,
      ),
    ).toThrowError(PaymentsConfigurationError);
  });

  it.each(["TRUE", "FALSE", " true", "false "])(
    "requires an exact trust-proxy boolean in every environment: %s",
    (PAYMENTS_TRUST_PROXY) => {
      expect(() =>
        readPaymentCreateConfig(
          { ...baseEnv, PAYMENTS_TRUST_PROXY },
          publishedOffer,
        ),
      ).toThrowError(PaymentsConfigurationError);
    },
  );

  it("requires HTTPS URLs in production", () => {
    expect(() =>
      readPaymentCreateConfig(
        {
          ...baseEnv,
          NODE_ENV: "production",
          SITE_URL: "http://example.org",
          YOOKASSA_RETURN_URL: "http://example.org/donation/result",
          PAYMENTS_TRUST_PROXY: "true",
        },
        publishedOffer,
      ),
    ).toThrowError(PaymentsConfigurationError);
  });

  it("accepts matching HTTPS URLs with a trusted production proxy", () => {
    expect(
      readPaymentCreateConfig(
        {
          ...baseEnv,
          NODE_ENV: "production",
          SITE_URL: "https://example.org",
          YOOKASSA_RETURN_URL: "https://example.org/donation/result",
          PAYMENTS_TRUST_PROXY: "true",
        },
        publishedOffer,
      ),
    ).toMatchObject({
      siteUrl: new URL("https://example.org"),
      returnUrl: new URL("https://example.org/donation/result"),
      trustProxy: true,
    });
  });

  it.each([undefined, "staging", "Production"])(
    "applies the HTTPS safeguard to non-local environment %s",
    (NODE_ENV) => {
      expect(() =>
        readPaymentCreateConfig(
          {
            ...baseEnv,
            NODE_ENV,
            PAYMENTS_TRUST_PROXY: "true",
          },
          publishedOffer,
        ),
      ).toThrowError(PaymentsConfigurationError);
    },
  );

  it.each([undefined, "staging", "Production"])(
    "applies the trusted-proxy safeguard to non-local environment %s",
    (NODE_ENV) => {
      expect(() =>
        readPaymentCreateConfig(
          {
            ...baseEnv,
            NODE_ENV,
            SITE_URL: "https://example.org",
            YOOKASSA_RETURN_URL: "https://example.org/donation/result",
            PAYMENTS_TRUST_PROXY: "false",
          },
          publishedOffer,
        ),
      ).toThrowError(PaymentsConfigurationError);
    },
  );

  it("requires exactly the same site and return origins", () => {
    expect(() =>
      readPaymentCreateConfig(
        {
          ...baseEnv,
          SITE_URL: "https://example.org",
          YOOKASSA_RETURN_URL: "https://www.example.org/donation/result",
        },
        publishedOffer,
      ),
    ).toThrowError(PaymentsConfigurationError);
  });

  it.each([
    "https://user:pass@example.org/donation/result",
    "https://example.org/other",
    "https://example.org/donation/result/",
    "https://example.org/donation/result?payment=1",
    "https://example.org/donation/result#payment",
  ])("requires a clean exact donation result URL: %s", (returnUrl) => {
    expect(() =>
      readPaymentCreateConfig(
        {
          ...baseEnv,
          SITE_URL: "https://example.org",
          YOOKASSA_RETURN_URL: returnUrl,
        },
        publishedOffer,
      ),
    ).toThrowError(PaymentsConfigurationError);
  });

  it.each([
    "https://user:pass@example.org",
    "https://example.org?source=test",
    "https://example.org#fragment",
  ])("rejects credentials, query, or fragment in the site URL: %s", (siteUrl) => {
    expect(() =>
      readPaymentCreateConfig(
        {
          ...baseEnv,
          SITE_URL: siteUrl,
          YOOKASSA_RETURN_URL: "https://example.org/donation/result",
        },
        publishedOffer,
      ),
    ).toThrowError(PaymentsConfigurationError);
  });

  it.each([undefined, "false", "TRUE", "true "])(
    "requires exact trust-proxy true in enabled production: %s",
    (PAYMENTS_TRUST_PROXY) => {
      expect(() =>
        readPaymentCreateConfig(
          {
            ...baseEnv,
            NODE_ENV: "production",
            SITE_URL: "https://example.org",
            YOOKASSA_RETURN_URL: "https://example.org/donation/result",
            PAYMENTS_TRUST_PROXY,
          },
          publishedOffer,
        ),
      ).toThrowError(PaymentsConfigurationError);
    },
  );
});

describe("payment operations documentation", () => {
  it("keeps payment env names, webhook path and the disabled production note", () => {
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8");

    for (const name of [
      "PAYMENTS_ENABLED",
      "PAYMENTS_OFFER_VERSION",
      "PAYMENTS_RATE_LIMIT_SECRET",
      "PAYMENTS_TRUST_PROXY",
      "YOOKASSA_SHOP_ID",
      "YOOKASSA_SECRET_KEY",
      "YOOKASSA_RETURN_URL",
    ]) {
      expect(envExample).toContain(name);
      expect(readme).toContain(name);
    }

    expect(packageJson).toContain("test:integration:payments");
    expect(readme).toContain("/api/payments/create");
    expect(readme).toContain("/api/payments/webhook");
    expect(readme).toContain("PAYMENTS_ENABLED=false");
  });
});

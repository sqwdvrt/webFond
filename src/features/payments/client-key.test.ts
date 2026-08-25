import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createPaymentClientKey,
  normalizeClientAddress,
} from "@/features/payments/client-key";

const secret = "payment-rate-limit-secret";

function expectedKey(value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

describe("normalizeClientAddress", () => {
  it("trims and canonicalizes IPv4 addresses", () => {
    expect(normalizeClientAddress(" 192.0.2.10 \t")).toBe("192.0.2.10");
  });

  it("canonicalizes equivalent expanded and compressed IPv6 addresses", () => {
    expect(normalizeClientAddress("2001:0DB8:0000:0000:0000:0000:0000:0001"))
      .toBe("2001:db8::1");
    expect(normalizeClientAddress("2001:db8::1")).toBe("2001:db8::1");
  });

  it("fails closed instead of throwing for scoped IPv6", () => {
    expect(normalizeClientAddress("fe80::1%eth0")).toBe("unknown");
  });

  it.each([undefined, null, "", "not-an-ip", "127.0.0.1:3000"])(
    "fails closed for an invalid or missing address: %s",
    (address) => {
      expect(normalizeClientAddress(address)).toBe("unknown");
    },
  );
});

describe("createPaymentClientKey", () => {
  it("uses the first forwarded address in production", () => {
    const headers = new Headers({
      "x-forwarded-for": " 2001:0db8:0:0:0:0:0:1 , 192.0.2.1",
      "x-real-ip": "198.51.100.2",
    });

    expect(
      createPaymentClientKey({
        headers,
        secret,
        trustProxy: true,
        environment: "production",
      }),
    ).toBe(expectedKey("2001:db8::1"));
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const headers = new Headers({ "x-real-ip": " 192.0.2.10 " });

    expect(
      createPaymentClientKey({
        headers,
        secret,
        trustProxy: true,
        environment: "production",
      }),
    ).toBe(expectedKey("192.0.2.10"));
  });

  it("fails closed when proxy trust is disabled", () => {
    const headers = new Headers({ "x-forwarded-for": "192.0.2.10" });

    expect(
      createPaymentClientKey({
        headers,
        secret,
        trustProxy: false,
        environment: "production",
      }),
    ).toBe(expectedKey("unknown"));
  });

  it("fails closed for invalid forwarded values without trusting later entries", () => {
    const headers = new Headers({
      "x-forwarded-for": "invalid, 192.0.2.10",
      "x-real-ip": "198.51.100.2",
    });

    expect(
      createPaymentClientKey({
        headers,
        secret,
        trustProxy: true,
        environment: "production",
      }),
    ).toBe(expectedKey("unknown"));
  });

  it("fails closed for a scoped IPv6 forwarding value", () => {
    const headers = new Headers({ "x-forwarded-for": "fe80::1%eth0" });

    expect(
      createPaymentClientKey({
        headers,
        secret,
        trustProxy: true,
        environment: "production",
      }),
    ).toBe(expectedKey("unknown"));
  });

  it.each(["development", "test"])(
    "uses one stable local key outside production: %s",
    (environment) => {
      const headers = new Headers({ "x-forwarded-for": "192.0.2.10" });

      expect(
        createPaymentClientKey({
          headers,
          secret,
          trustProxy: true,
          environment,
        }),
      ).toBe(expectedKey("local"));
    },
  );

  it.each([undefined, "staging", "Production"])(
    "uses trusted forwarding safeguards in non-local environment %s",
    (environment) => {
      const headers = new Headers({ "x-forwarded-for": "192.0.2.10" });

      expect(
        createPaymentClientKey({
          headers,
          secret,
          trustProxy: true,
          environment,
        }),
      ).toBe(expectedKey("192.0.2.10"));
    },
  );

  it.each([undefined, "staging", "Production"])(
    "fails closed without proxy trust in non-local environment %s",
    (environment) => {
      const headers = new Headers({ "x-forwarded-for": "192.0.2.10" });

      expect(
        createPaymentClientKey({
          headers,
          secret,
          trustProxy: false,
          environment,
        }),
      ).toBe(expectedKey("unknown"));
    },
  );
});

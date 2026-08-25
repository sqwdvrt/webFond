import { describe, expect, it } from "vitest";

import { requireSafePaymentsTestDatabaseUrl } from "./test-database-url";

const localUrl = "postgresql://tester@localhost/foundation_payments_test";
const ciUrl = "postgresql://tester@postgres/foundation_payments_test";

describe("requireSafePaymentsTestDatabaseUrl", () => {
  it.each(["localhost", "127.0.0.1"])(
    "allows the local host %s outside CI",
    (hostname) => {
      expect(
        requireSafePaymentsTestDatabaseUrl({
          PAYMENTS_TEST_DATABASE_URL: localUrl.replace("localhost", hostname),
        }),
      ).toContain(`@${hostname}/foundation_payments_test`);
    },
  );

  it("rejects the postgres service hostname outside CI", () => {
    expect(() =>
      requireSafePaymentsTestDatabaseUrl({
        PAYMENTS_TEST_DATABASE_URL: ciUrl,
      }),
    ).toThrow("localhost, 127.0.0.1, or the CI postgres service");
  });

  it("allows the exact postgres service hostname when CI is exactly true", () => {
    expect(
      requireSafePaymentsTestDatabaseUrl({
        CI: "true",
        PAYMENTS_TEST_DATABASE_URL: ciUrl,
      }),
    ).toBe(ciUrl);
  });

  it.each(["TRUE", "1", " true", "true "])(
    "does not enable the postgres service hostname for CI=%s",
    (CI) => {
      expect(() =>
        requireSafePaymentsTestDatabaseUrl({
          CI,
          PAYMENTS_TEST_DATABASE_URL: ciUrl,
        }),
      ).toThrow("localhost, 127.0.0.1, or the CI postgres service");
    },
  );

  it("rejects an arbitrary remote hostname even in CI", () => {
    expect(() =>
      requireSafePaymentsTestDatabaseUrl({
        CI: "true",
        PAYMENTS_TEST_DATABASE_URL:
          "postgresql://tester@db.example.com/foundation_payments_test",
      }),
    ).toThrow("localhost, 127.0.0.1, or the CI postgres service");
  });

  it("still requires the CI database basename to end with _test", () => {
    expect(() =>
      requireSafePaymentsTestDatabaseUrl({
        CI: "true",
        PAYMENTS_TEST_DATABASE_URL:
          "postgresql://tester@postgres/foundation_payments",
      }),
    ).toThrow("database name must end with _test");
  });

  it("still requires PostgreSQL in CI", () => {
    expect(() =>
      requireSafePaymentsTestDatabaseUrl({
        CI: "true",
        PAYMENTS_TEST_DATABASE_URL:
          "https://tester@postgres/foundation_payments_test",
      }),
    ).toThrow("must use the PostgreSQL protocol");
  });
});

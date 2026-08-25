type PaymentsTestDatabaseEnvironment = Readonly<
  Record<string, string | undefined>
>;

export function requireSafePaymentsTestDatabaseUrl(
  env: PaymentsTestDatabaseEnvironment = process.env,
): string {
  const value = env.PAYMENTS_TEST_DATABASE_URL;

  if (!value) {
    throw new Error(
      "PAYMENTS_TEST_DATABASE_URL is required for payment integration tests",
    );
  }

  let url: URL;
  let databaseName: string;
  try {
    url = new URL(value);
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error(
      "PAYMENTS_TEST_DATABASE_URL must be a valid PostgreSQL URL",
    );
  }

  const isPostgres =
    url.protocol === "postgresql:" || url.protocol === "postgres:";
  const isLocalHost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isCiService = env.CI === "true" && url.hostname === "postgres";

  if (!isPostgres) {
    throw new Error(
      "PAYMENTS_TEST_DATABASE_URL must use the PostgreSQL protocol",
    );
  }
  if (!isLocalHost && !isCiService) {
    throw new Error(
      "PAYMENTS_TEST_DATABASE_URL must use localhost, 127.0.0.1, or the CI postgres service",
    );
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !databaseName.endsWith("_test")
  ) {
    throw new Error(
      "PAYMENTS_TEST_DATABASE_URL database name must end with _test",
    );
  }

  return url.toString();
}

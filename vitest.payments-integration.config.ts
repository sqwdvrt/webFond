import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { requireSafePaymentsTestDatabaseUrl } from "./src/features/payments/test-database-url.js";

const paymentIntegrationPath =
  "src/features/payments/payments.integration.test.ts";

requireSafePaymentsTestDatabaseUrl();

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [paymentIntegrationPath],
  },
});

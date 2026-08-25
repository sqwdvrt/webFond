import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

const paymentIntegrationPath =
  "src/features/payments/payments.integration.test.ts";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    exclude: [
      ...configDefaults.exclude,
      paymentIntegrationPath,
      ".worktrees/**",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});

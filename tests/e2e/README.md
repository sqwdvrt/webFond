Run in an isolated checkout without dotenv files, with Node 22 and a local PostgreSQL 16 database whose name ends in `_test`:

```sh
export E2E_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/foundation_browser_test
npm ci
npx playwright install --with-deps chromium
node scripts/run-e2e.mjs migrate
node scripts/run-e2e.mjs build
npm run test:e2e
```

The runner validates before migration/build/start, rejects remote/public targets and dotenv files, and passes only an allowlist of environment variables to child processes. No production credentials are inherited. Use this dedicated database exclusively for smoke tests. Both production servers bind loopback; ports 3017 and 3018 must be free. Existing servers cannot be reused. The second server enables the published payment form with dummy credentials; browser interception stubs every payment-create request before interaction. The suite blocks all external browser requests. It never calls the payment provider. Contact fixtures use unique `.invalid` email addresses and delete only their own rows; local rate-limit buckets expire naturally. Tests run serially (two contact submissions total) and do not delete shared buckets. Failure artifacts can contain synthetic contact evidence; CI retains them seven days.

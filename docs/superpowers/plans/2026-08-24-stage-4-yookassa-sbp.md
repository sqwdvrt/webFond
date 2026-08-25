# Stage 4 YooKassa SBP Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать безопасные разовые анонимные пожертвования через СБП с
redirect-страницей ЮKassa, проверяемым webhook, идемпотентным локальным статусом,
страницами результата и обязательными PostgreSQL integration-тестами.

**Architecture:** Модуль `src/features/payments` изолирует конфигурацию,
валидацию, PostgreSQL rate limits, запись `Donation`, HTTP-клиент ЮKassa,
оркестрацию создания и единый reconcile service. Тонкие Next.js Route Handlers,
server pages и client form зависят от явных интерфейсов и тестируются через DI.
Webhook и return page не доверяют входным данным и подтверждают статус
авторизованным GET в ЮKassa.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Prisma 6,
PostgreSQL, Vitest 4, Testing Library, YooKassa REST API v3 через `fetch`.

**Design spec:** `docs/superpowers/specs/2026-08-24-stage-4-yookassa-sbp-design.md`

**Commit policy:** Не создавать git-коммиты без отдельного явного запроса
пользователя. После каждой задачи оставлять рабочее дерево в проверенном состоянии.

---

## File Structure

- `src/content/donation-offer.ts`: машинный статус, версия и утвержденный текст
  оферты.
- `src/features/payments/types.ts`: внутренние типы платежа и outcomes.
- `src/features/payments/gate.ts`: единый legal/feature gate для UI и API.
- `src/features/payments/config.ts`: строгая server-only конфигурация.
- `src/features/payments/client-key.ts`: нормализованный HMAC client key.
- `src/features/payments/validation.ts`: сумма, UUID, оферта и webhook envelope.
- `src/features/payments/read-limited-body.ts`: потоковое ограничение HTTP body.
- `src/features/payments/rate-limit.ts`: атомарные PostgreSQL buckets.
- `src/features/payments/repository.ts`: write-side `Donation` и транзакция начала
  попытки.
- `src/features/payments/yookassa-client.ts`: create/get REST-клиент.
- `src/features/payments/reconcile.ts`: проверка provider payment и переходы.
- `src/features/payments/create-payment.ts`: идемпотентная оркестрация create.
- `src/features/payments/attempt-storage.ts`: lifecycle UUID в `sessionStorage`.
- `src/app/api/payments/create/route.ts`: публичный create endpoint.
- `src/app/api/payments/webhook/route.ts`: webhook endpoint.
- `src/components/donation/donation-form.tsx`: client form.
- `src/app/help/page.tsx`: server-side gate формы.
- `src/app/donation/result/*`: result page, 404 и error boundary.
- `prisma/migrations/20260824195000_payment_rate_limit_bucket/migration.sql`:
  rate-limit table.
- `src/features/payments/payments.integration.test.ts`: обязательные DB-сценарии.
- `vitest.payments-integration.config.ts`: отдельный integration runner.
- `.github/workflows/payments-integration.yml`: PostgreSQL CI job.

### Task 1: Add the Machine-Readable Donation Offer Gate

**Files:**
- Create: `src/content/donation-offer.ts`
- Create: `src/content/donation-offer.test.ts`
- Create: `src/features/payments/gate.ts`
- Create: `src/features/payments/gate.test.ts`
- Modify: `src/app/donation-offer/page.tsx`
- Create: `src/app/donation-offer/page.test.tsx`
- Modify: `src/content/content-integrity.test.ts`

- [ ] **Step 1: Write failing legal-source and gate tests**

Cover the current placeholder, a published offer with matching version and
non-empty approved sections, disabled payments, missing text, blank paragraphs,
a missing version and a mismatched version. The gate must accept the offer as an
argument so tests never mutate the real placeholder. Add a failing renderer test:
`renderDonationOfferPage(publishedFixture)` must render its title, every heading
and every paragraph; the real placeholder must still render `LegalPlaceholder`.

```ts
expect(donationOfferPublication).toEqual({
  status: "placeholder",
  version: null,
});

expect(
  evaluatePaymentsGate({
    enabledValue: "true",
    configuredOfferVersion: "2026-08-24",
    offer: {
      status: "published",
      version: "2026-08-24",
      title: "Оферта пожертвования",
      sections: [{ heading: "Условия", paragraphs: ["Проверенный текст"] }],
    },
  }),
).toEqual({ enabled: true });
```

- [ ] **Step 2: Run tests and verify RED**

Run:
`npm test -- src/content/donation-offer.test.ts src/features/payments/gate.test.ts src/app/donation-offer/page.test.tsx src/content/content-integrity.test.ts`

Expected: FAIL because the legal source and gate do not exist.

- [ ] **Step 3: Implement the discriminated legal source and pure gate**

```ts
export type DonationOfferPublication =
  | { status: "placeholder"; version: null }
  | {
      status: "published";
      version: string;
      title: string;
      sections: readonly {
        heading: string;
        paragraphs: readonly string[];
      }[];
    };

export const donationOfferPublication: DonationOfferPublication = {
  status: "placeholder",
  version: null,
};
```

Expose `evaluatePaymentsGate(input): { enabled: true } | { enabled: false }`.
Only the exact string `"true"`, a published offer, an exact non-empty version,
non-empty title/sections/headings and non-blank paragraphs enable payments. This
prevents a status flip from enabling payments while the page still has no
approved text. Do not expose the failure reason in public UI.

- [ ] **Step 4: Wire the offer page to the source**

Import `donationOfferPublication` in `src/app/donation-offer/page.tsx`; preserve
the current `LegalPlaceholder` while status is `placeholder`. The published
branch renders title and every approved section from the same object the gate
validated. Default export delegates to injectable
`renderDonationOfferPage(donationOfferPublication)`. Do not invent legal copy.

- [ ] **Step 5: Run focused tests**

Expected: all Task 1 tests PASS.

### Task 2: Define Payment Types, Configuration, and Request Validation

**Files:**
- Create: `src/features/payments/types.ts`
- Create: `src/features/payments/config.ts`
- Create: `src/features/payments/config.test.ts`
- Create: `src/features/payments/client-key.ts`
- Create: `src/features/payments/client-key.test.ts`
- Create: `src/features/payments/validation.ts`
- Create: `src/features/payments/validation.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing configuration tests**

Test three independent readers:

- `readPaymentsAvailability()` evaluates only the legal gate for `/help`;
- `readYooKassaConfig()` reads shop ID/secret and remains available to
  webhook/result even when new payments are disabled;
- `readPaymentCreateConfig()` combines the legal gate, URLs, rate-limit secret
  and trusted-proxy requirement for create route.

Cover disabled-by-default behavior, exact boolean parsing, minimum 32-character
rate-limit secret, production HTTPS, matching `SITE_URL` and return URL origins,
exact `/donation/result` path, rejection of credentials/query/fragment, and
`production + enabled` requiring `PAYMENTS_TRUST_PROXY=true`. Inject `env` and
offer publication.

```ts
type YooKassaConfig = {
  shopId: string;
  secretKey: string;
};

type PaymentCreateConfig = YooKassaConfig & {
  siteUrl: URL;
  returnUrl: URL;
  rateLimitSecret: string;
  trustProxy: boolean;
};
```

Disabling new payments must never prevent webhook/result from reconciling
already-created payments. Every reader throws `PaymentsConfigurationError`
without secret values.

- [ ] **Step 2: Run config tests and verify RED**

Run: `npm test -- src/features/payments/config.test.ts`

Expected: FAIL because `config.ts` does not exist.

- [ ] **Step 3: Implement strict server-only config**

Follow `src/lib/admin-auth/config.ts`. Parse URLs with `new URL()`, normalize
origins, and keep all payment secrets outside `NEXT_PUBLIC_*`.

- [ ] **Step 4: Write failing normalized client-key tests**

Test trusted first `x-forwarded-for` entry, `x-real-ip` fallback, whitespace,
invalid values, IPv4 normalization, equivalent expanded/compressed IPv6 and
production fail-closed behavior. Implement `normalizeClientAddress` with
`node:net.isIP`; canonicalize IPv6 through the URL parser before HMAC-SHA256.
Never hash an unvalidated forwarding string. The result API is:

```ts
createPaymentClientKey({
  headers,
  secret,
  trustProxy,
  environment,
}): string
```

- [ ] **Step 5: Run client-key tests and verify RED**

Run: `npm test -- src/features/payments/client-key.test.ts`

Expected: FAIL because payment client-key handling is absent.

- [ ] **Step 6: Implement the normalized HMAC key**

Do not modify admin authentication behavior. Reuse only its HMAC design, not its
unvalidated forwarding parser.

- [ ] **Step 7: Write failing validation tests**

Cover presets and every integer from 100 through 100000, rejecting decimals,
numeric strings with exponents, booleans, unsafe numbers, missing offer,
non-v4 UUID, extra/oversized strings, and non-empty honeypot. Add webhook
envelope cases for `type`, `event`, and `object.id`.

```ts
type PaymentCreateInput = {
  amountRoubles: number;
  acceptedOffer: true;
  attemptId: string;
  website: "";
};
```

Expose `parsePaymentCreateInput(unknown)` and
`parseWebhookEnvelope(unknown)` as discriminated results.

- [ ] **Step 8: Run validation tests and verify RED**

Run: `npm test -- src/features/payments/validation.test.ts`

Expected: FAIL because validation is absent.

- [ ] **Step 9: Implement minimal validation and env example**

Convert rubles to integer kopecks only after integer/range checks. Add:

```dotenv
PAYMENTS_ENABLED="false"
PAYMENTS_OFFER_VERSION=""
PAYMENTS_RATE_LIMIT_SECRET=""
PAYMENTS_TRUST_PROXY="false"
```

Keep existing `YOOKASSA_*` and `SITE_URL`.

- [ ] **Step 10: Run Task 2 tests**

Run:
`npm test -- src/features/payments/config.test.ts src/features/payments/client-key.test.ts src/features/payments/validation.test.ts`

Expected: PASS.

### Task 3: Add the PostgreSQL Rate-Limit Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260824195000_payment_rate_limit_bucket/migration.sql`
- Modify: `src/db/schema.test.ts`

- [ ] **Step 1: Write failing schema regression assertions**

Assert the model, composite primary key and expiry index in both Prisma and SQL.

```prisma
model PaymentRateLimitBucket {
  key         String
  windowStart DateTime
  count       Int
  expiresAt   DateTime

  @@id([key, windowStart])
  @@index([expiresAt])
}
```

- [ ] **Step 2: Run schema test and verify RED**

Run: `npm test -- src/db/schema.test.ts`

Expected: FAIL because the model and migration are missing.

- [ ] **Step 3: Add model and forward-only SQL migration**

Create only the new table, primary key and `"PaymentRateLimitBucket_expiresAt_idx"`.
Do not modify prior migrations.

- [ ] **Step 4: Validate and generate Prisma**

Run: `npm run db:validate && npm run db:generate`

Expected: both commands succeed.

- [ ] **Step 5: Run schema test**

Run: `npm test -- src/db/schema.test.ts`

Expected: PASS.

### Task 4: Write the Failing PostgreSQL Payment Contract

**Files:**
- Create: `src/features/payments/payments.integration.test.ts`
- Create: `vitest.payments-integration.config.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the isolated Node integration runner**

The dedicated config uses `environment: "node"` and includes only
`src/features/payments/payments.integration.test.ts`. The default config excludes
only that exact payment test path via
`exclude: [...configDefaults.exclude, exactPaymentPath]` imported from
`vitest/config`; replacing defaults would discover `node_modules`. Do not exclude
all `*.integration.test.ts`, because existing explicit content integration
commands must keep working.

The test bootstrap:

1. requires `PAYMENTS_TEST_DATABASE_URL`;
2. parses and verifies a local/CI host and database name ending `_test`;
3. creates its own Prisma client with
   `new PrismaClient({ datasources: { db: { url: verifiedUrl } } })`;
4. never uses ambient `DATABASE_URL` for test queries;
5. passes that exact client to `createPaymentRepository(client)`;
6. clears fixed global rate buckets and test-owned donations before/after cases.

- [ ] **Step 2: Add the script and verify the safety guard**

```json
"test:integration:payments": "vitest run --config vitest.payments-integration.config.ts"
```

Run without env: `npm run test:integration:payments`

Expected: FAIL before tests with a safe message requiring
`PAYMENTS_TEST_DATABASE_URL`.

- [ ] **Step 3: Write real-PostgreSQL tests before the SQL implementation**

Against the Task 3 schema, specify:

- two concurrent begin-attempt calls create one Donation;
- one UUID consumes new-attempt quota once and request quota twice;
- all four limits and rollback at the boundary;
- unique/conditional provider binding;
- webhook-style binding before create-response binding;
- concurrent terminal transitions change one row once;
- success cannot be overwritten by canceled;
- expired-bucket cleanup;
- a failed transaction leaves no partial Donation or bucket increments.

Use UUID/prefix fixtures and clean every fixed global bucket so test order does
not affect limits.

- [ ] **Step 4: Apply migrations to a safe test DB and verify RED**

```bash
DATABASE_URL="$PAYMENTS_TEST_DATABASE_URL" npx prisma migrate deploy
npm run test:integration:payments
```

Expected: FAIL because `rate-limit.ts` and `repository.ts` do not exist. If no
safe PostgreSQL is available, stop and obtain one before implementing Task 5;
do not replace this RED run with mocks.

### Task 5: Implement Atomic Attempt Creation and DB Rate Limits

**Files:**
- Create: `src/features/payments/rate-limit.ts`
- Create: `src/features/payments/rate-limit.test.ts`
- Create: `src/features/payments/repository.ts`
- Create: `src/features/payments/repository.test.ts`

- [ ] **Step 1: Write failing rate-limit unit tests**

Use an injectable transaction client. Cover UTC window boundaries, per-client
all-request 20/10m, per-client new-attempt 5/10m, global all-request 300/1m,
global new-attempt 100/1m, `Retry-After`, and scope-specific bucket keys.

Expose:

```ts
consumeBucket(tx, { key, now, windowMs, limit }): Promise<void>
paymentLimitKeys(clientKey): {
  clientRequests: string;
  clientAttempts: string;
  globalRequests: string;
  globalAttempts: string;
}
```

Use parameterized `$queryRaw`, never string concatenation.

- [ ] **Step 2: Verify rate-limit RED**

Run: `npm test -- src/features/payments/rate-limit.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement fixed-window atomic upsert**

Use PostgreSQL:

```sql
INSERT INTO "PaymentRateLimitBucket" ("key", "windowStart", "count", "expiresAt")
VALUES ($1, $2, 1, $3)
ON CONFLICT ("key", "windowStart")
DO UPDATE SET
  "count" = "PaymentRateLimitBucket"."count" + 1,
  "expiresAt" = EXCLUDED."expiresAt"
RETURNING "count";
```

Throw a typed `PaymentRateLimitedError(retryAfterSeconds)` when count exceeds
the limit. The surrounding transaction rollback leaves the bucket at its limit.

- [ ] **Step 4: Write failing repository tests**

Cover:
- transaction begins with both all-request buckets;
- `pg_advisory_xact_lock(hashtextextended(attemptId, 0))` serializes one UUID;
- existing UUID does not consume new-attempt buckets;
- new UUID consumes both new-attempt buckets and creates one `PENDING` donation;
- same UUID with a different amount returns conflict;
- provider ID can bind only `null → id` or repeat the same ID;
- draft deletion requires `PENDING` and `providerPaymentId: null`;
- terminal update requires current `PENDING`;
- `SUCCEEDED` writes `paidAt`; `CANCELED` leaves it null.

Define a small `PaymentRepository` interface used by services and a factory:

```ts
type BeginAttemptResult =
  | { kind: "existing"; donation: PaymentDonation }
  | { kind: "created"; donation: PaymentDonation };

beginAttempt(input): Promise<BeginAttemptResult>
findById(id): Promise<PaymentDonation | null>
findByProviderPaymentId(id): Promise<PaymentDonation | null>
bindProviderPaymentId(donationId, providerId): Promise<BindResult>
transitionPending(donationId, status, paidAt): Promise<PaymentDonation>
deleteUnboundPending(donationId): Promise<void>

createPaymentRepository(client): PaymentRepository
```

- [ ] **Step 5: Verify repository RED**

Run: `npm test -- src/features/payments/repository.test.ts`

Expected: FAIL because the repository is absent.

- [ ] **Step 6: Implement repository and cleanup**

`createPaymentRepository(client)` executes every operation, transaction and
cleanup through the supplied client. Export a production instance created from
`src/lib/db.ts`, but never close over that singleton inside factory methods. Run
all four limit decisions, advisory lock, lookup and optional create in one Prisma
interactive transaction. Run expired-bucket cleanup after the main transaction
and ignore only cleanup failure.

- [ ] **Step 7: Run Task 5 unit tests**

Run:
`npm test -- src/features/payments/rate-limit.test.ts src/features/payments/repository.test.ts`

Expected: PASS.

- [ ] **Step 8: Run the prewritten PostgreSQL contract and verify GREEN**

Run: `npm run test:integration:payments`

Expected: PASS against the same verified test DB, with no skipped tests.

### Task 6: Implement the Minimal YooKassa REST Client

**Files:**
- Create: `src/features/payments/yookassa-client.ts`
- Create: `src/features/payments/yookassa-client.test.ts`
- Create: `src/features/payments/__fixtures__/create-pending.json`
- Create: `src/features/payments/__fixtures__/payment-succeeded.json`
- Create: `src/features/payments/__fixtures__/payment-canceled.json`

- [ ] **Step 1: Write failing create-payment contract tests**

Inject `fetch` and timer/AbortSignal behavior. Assert:

```ts
{
  amount: { value: "300.00", currency: "RUB" },
  payment_method_data: { type: "sbp" },
  confirmation: {
    type: "redirect",
    return_url: "https://example.org/donation/result?donation=local-id"
  },
  capture: true,
  description: "Пожертвование Фонду «Быть Добру»",
  metadata: { donationId: "local-id" }
}
```

Assert Basic Auth, `Idempotence-Key`, `Content-Type`, `Accept`, 5-second timeout
and `redirect: "error"`. Response fixtures must verify strict decimal money
parsing, currency, metadata donation ID, status, `payment_method.type`,
confirmation type and HTTPS URL. Add idempotent POST fixtures that already return
`succeeded` and `canceled`, not only `pending`. Ensure errors never include
credentials or provider body.

- [ ] **Step 2: Run create client tests and verify RED**

Run: `npm test -- src/features/payments/yookassa-client.test.ts`

Expected: FAIL because the client is missing.

- [ ] **Step 3: Implement create and response parser**

Expose `createPayment(input)` and typed errors:
`YooKassaHttpError(status)`, `YooKassaUnavailableError`,
`YooKassaProtocolError`. Parse only fields needed by the application. Convert
provider money only from `^[0-9]+\.[0-9]{2}$` into safe integer kopecks; never
use floating-point parsing.

- [ ] **Step 4: Add failing GET/status tests**

Cover exact URL encoding, returned ID equality, pending/succeeded/canceled and
unexpected statuses, exact amount/currency/metadata, `payment_method.type`,
confirmation type/URL, `paid`, `captured_at`, malformed JSON, HTTP redirect,
400/401/403/404/429 and 5xx.

- [ ] **Step 5: Implement GET and run tests**

Run: `npm test -- src/features/payments/yookassa-client.test.ts`

Expected: PASS.

### Task 7: Build the Single Reconcile Service

**Files:**
- Create: `src/features/payments/alerts.ts`
- Create: `src/features/payments/reconcile.ts`
- Create: `src/features/payments/reconcile.test.ts`

- [ ] **Step 1: Write failing permanent-validation tests**

Cover missing donation, GET ID mismatch, metadata mismatch, amount/currency
mismatch, non-SBP payment, another bound provider ID and provider GET 404. Each
case must leave DB unchanged and return:

```ts
{ kind: "permanent-rejection", alertCode: "..." }
```

The default alert writes only a fixed code, never donation/payment IDs or payload.

- [ ] **Step 2: Verify permanent-case RED**

Run: `npm test -- src/features/payments/reconcile.test.ts`

Expected: FAIL because reconcile does not exist.

- [ ] **Step 3: Implement the shared verified-payment core**

Expose both:

```ts
reconcilePaymentById({ paymentId, terminalEvent }, deps)
reconcileVerifiedPayment({ payment, terminalEvent }, deps)
```

The first performs GET and delegates every status decision to the second. The
second accepts either an authenticated GET response or the authenticated create
response, reads `metadata.donationId`, loads the donation, validates
ID/amount/currency/SBP and atomically binds `null → providerId`. Re-read on a
lost bind race. Create, webhook and result must not implement status mapping
outside this module.

- [ ] **Step 4: Add failing status-matrix tests**

Cover:
- `pending` without terminal event → no update;
- terminal event whose GET is still `pending` → retryable;
- `waiting_for_capture` → retryable protocol state;
- `succeeded` requires `paid=true` and valid `captured_at`;
- `canceled` transitions without `paidAt`;
- unknown status and malformed successful response → retryable protocol error;
- GET 400 → permanent invalid signal; 401/403 → retryable configuration failure;
  404 → permanent missing provider payment; 429/network/5xx → retryable;
- replay and concurrent terminal update are no-ops;
- stale event name does not override authenticated terminal GET;
- conflicting terminal local/remote state is a permanent alert, not overwrite.

- [ ] **Step 5: Implement status matrix**

Expose:

```ts
type ReconcileOutcome =
  | {
      kind: "pending";
      donation: PaymentDonation;
      confirmationUrl: string | null;
    }
  | { kind: "succeeded"; donation: PaymentDonation }
  | { kind: "canceled"; donation: PaymentDonation }
  | { kind: "retry"; code: string }
  | { kind: "permanent-rejection"; alertCode: string };
```

- [ ] **Step 6: Run reconcile tests**

Expected: PASS.

### Task 8: Implement Idempotent Create-Payment Orchestration

**Files:**
- Create: `src/features/payments/create-payment.ts`
- Create: `src/features/payments/create-payment.test.ts`

- [ ] **Step 1: Write failing happy-path test**

Begin an attempt, construct return URL by cloning configured
`YOOKASSA_RETURN_URL`, append exactly one `donation` parameter, call ЮKassa,
then pass the authenticated create response to `reconcileVerifiedPayment`.
Return:

```ts
type CreatePaymentOutcome =
  | { kind: "redirect"; url: string; donationId: string }
  | { kind: "result"; url: string; donationId: string }
  | { kind: "stale-attempt" }
  | { kind: "conflict" };
```

- [ ] **Step 2: Verify happy-path RED**

Run: `npm test -- src/features/payments/create-payment.test.ts`

Expected: FAIL because the orchestrator is missing.

- [ ] **Step 3: Implement the minimal happy path**

Accept repository/client/reconcile/config/clock as dependencies. Validate
confirmation URL: absolute HTTPS, hostname present, no username/password. Never
accept a redirect URL from browser input. The orchestrator may choose redirect
vs local result, but all provider validation, binding and status transitions
come from reconcile.

- [ ] **Step 4: Add failing retry and race tests**

Cover:
- existing unbound attempt younger than 23 hours repeats POST with same key;
- exactly 23 hours is stale and never calls provider;
- any existing bound attempt, including a locally terminal one, calls
  `reconcilePaymentById`; no provider-ID record bypasses authenticated GET;
- pending reconcile requires a valid confirmation URL before redirect;
- idempotent repeated POST may reconcile directly to succeeded/canceled;
- early webhook binds and completes while create call is in flight;
- early terminal reconcile returns result URL instead of stale confirmation URL;
- amount conflict never calls provider;
- malformed pending response without confirmation URL preserves draft/provider ID;
- deterministic 4xx cleanup mapping;
- timeout/network/429/5xx preserve draft for same-key retry;
- DB failure after provider response never creates a second key.

- [ ] **Step 5: Implement exact provider error mapping**

Map:
- 400 and other deterministic 4xx → delete unbound draft, provider-rejected;
- 401/403 → delete unbound draft, configuration unavailable;
- 404 → delete unbound draft, provider endpoint error;
- 429/network/timeout/5xx → preserve draft, retryable unavailable;
- malformed success → preserve draft, protocol error.

- [ ] **Step 6: Run orchestrator tests**

Expected: PASS.

### Task 9: Add the Payment Create Route

**Files:**
- Create: `src/features/payments/read-limited-body.ts`
- Create: `src/features/payments/read-limited-body.test.ts`
- Create: `src/app/api/payments/create/route.ts`
- Create: `src/app/api/payments/create/route.test.ts`

- [ ] **Step 1: Write failing HTTP guard tests**

Export `handlePaymentCreate(request, deps)`. Before business orchestration test:
- `Content-Length > 8192` and actual body > 8192 → 413;
- non-JSON → 415;
- missing/foreign Origin → 403;
- malformed JSON/validation → 400;
- honeypot → empty 204 without DB/YooKassa;
- disabled/misconfigured gate → 503;
- HMAC client key uses `createPaymentClientKey`;
- all responses use `Cache-Control: no-store`, no-referrer and nosniff.

Test a multi-chunk `ReadableStream`: the shared reader must cancel and stop
reading immediately after the accumulated byte limit, not call `request.text()`
and not buffer the remaining stream. Header guards run before any body read.

- [ ] **Step 2: Verify route RED**

Run:
`npm test -- src/features/payments/read-limited-body.test.ts src/app/api/payments/create/route.test.ts`

Expected: FAIL because the route is missing.

- [ ] **Step 3: Implement body reader and DI route**

Check `Content-Length`, `Content-Type` and `Origin` first. Then consume
`request.body.getReader()` chunk-by-chunk, cancel at 8193 bytes, decode once and
parse JSON. Evaluate create config, create normalized client key, then call
`createPayment`. The default `POST` only assembles real dependencies.

- [ ] **Step 4: Add failing outcome-mapping tests**

Assert exact statuses/codes:
- rate limit → 429 + integer `Retry-After`;
- stale/conflict → 409;
- validation/provider rejection → 400/502 as specified;
- provider/config temporary failure → 503;
- malformed provider response → 502;
- unknown error → 500;
- redirect/result outcome → 200 `{ redirectUrl, donationId }`.

- [ ] **Step 5: Implement mappings and run route tests**

Expected: PASS.

### Task 10: Add the Verified YooKassa Webhook Route

**Files:**
- Create: `src/app/api/payments/webhook/route.ts`
- Create: `src/app/api/payments/webhook/route.test.ts`

- [ ] **Step 1: Write failing webhook envelope tests**

Export `handlePaymentWebhook(request, deps)`. Cover 64 KiB content/actual limit,
malformed JSON, `type !== "notification"`, missing object ID, and unsupported
well-formed events. Exact outcomes: non-notification and unsupported events
return 200 without GET; missing/invalid `object.id` returns 400. Reuse the
streaming limited reader and prove it cancels after 65537 bytes.

- [ ] **Step 2: Verify webhook RED**

Run: `npm test -- src/app/api/payments/webhook/route.test.ts`

Expected: FAIL because the route is missing.

- [ ] **Step 3: Implement thin webhook adapter**

For `payment.succeeded` and `payment.canceled`, call reconcile with the event name
and object ID. Do not trust any other object fields. Apply the exact envelope
statuses from Step 1.

- [ ] **Step 4: Add failing outcome tests**

Map successful transition/replay/permanent rejection to 200. Map pending-after-
terminal, waiting-for-capture, malformed GET, network/429/5xx and DB failure to
503. Provider GET 400/404 is permanent 200 + alert; GET 401/403 is retryable 503
because server credentials are unusable. Verify secrets, payload and IDs never
reach report calls.

- [ ] **Step 5: Implement the outcome mappings**

Keep the HTTP adapter exhaustive over `ReconcileOutcome`; an unhandled variant
must fail TypeScript compilation.

- [ ] **Step 6: Run webhook tests**

Expected: PASS.

### Task 11: Implement Attempt Storage and the Accessible Donation Form

**Files:**
- Create: `src/features/payments/attempt-storage.ts`
- Create: `src/features/payments/attempt-storage.test.ts`
- Create: `src/components/donation/donation-form.tsx`
- Create: `src/components/donation/donation-form.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing storage tests**

Use injectable `Storage`, UUID and clock. Cover create/reload reuse, changed
amount confirmation, 23-hour stale state, invalid/corrupt storage, explicit new
attempt and terminal cleanup. A stale attempt must never auto-create a new UUID.

- [ ] **Step 2: Verify storage RED**

Run: `npm test -- src/features/payments/attempt-storage.test.ts`

Expected: FAIL because storage helper is missing.

- [ ] **Step 3: Implement small storage state machine**

Store one versioned JSON record in `sessionStorage`, with optional `donationId`
attached only after a successful create response. Return explicit states `ready`,
`amount-change-needs-confirmation`, and `stale-needs-confirmation`. Expose
`attachDonationMarker(attemptId, donationId)`; it updates only the matching
stored attempt.

- [ ] **Step 4: Write failing form behavior and accessibility tests**

Cover fixed amounts, custom 100/100000 boundaries, required offer checkbox,
offer link, hidden honeypot, submit/loading state, inline server error,
same-attempt retry, explicit new attempt confirmation, `window.location.assign`
with returned URL, labels/focus and axe scan. Assert the rendered form and exact
JSON payload contain no name, email, phone, `receipt`, personal-data checkbox or
link to personal-data consent. The create response includes
`{ redirectUrl, donationId }`; attach that marker to the matching attempt before
navigation.

- [ ] **Step 5: Verify form RED**

Run: `npm test -- src/components/donation/donation-form.test.tsx`

Expected: FAIL because the form is missing.

- [ ] **Step 6: Implement form and focused CSS**

Use existing `.donation-preview` visual language. Do not redesign unrelated
sections. Preserve keyboard operation and visible focus.

- [ ] **Step 7: Run Task 11 tests**

Expected: PASS.

### Task 12: Integrate the Feature Gate on the Help Page

**Files:**
- Modify: `src/app/help/page.tsx`
- Modify: `src/components/donation/donation-preview.tsx`
- Modify: `src/components/donation/donation-preview.test.tsx`
- Modify: `src/app/information-pages.test.tsx`

- [ ] **Step 1: Write failing enabled/disabled page tests**

Refactor to `renderHelpPage(deps?)`. Disabled/placeholder config renders the
existing honest “СБП подключается” preview. A published matching offer and enabled
config render `DonationForm`. Configuration errors fail closed to preview.

- [ ] **Step 2: Verify page RED**

Run:
`npm test -- src/app/information-pages.test.tsx src/components/donation/donation-preview.test.tsx`

Expected: FAIL because `/help` does not evaluate the gate.

- [ ] **Step 3: Implement server-side gate**

Both `/help` and create route call the same `readPaymentsAvailability` /
`evaluatePaymentsGate`; no client env decides availability.

- [ ] **Step 4: Run page and regression tests**

Expected: PASS.

### Task 13: Add Success, Canceled, Pending, and Error Results

**Files:**
- Create: `src/app/donation/result/page.tsx`
- Create: `src/app/donation/result/result-view.tsx`
- Create: `src/app/donation/result/attempt-cleanup.tsx`
- Create: `src/app/donation/result/not-found.tsx`
- Create: `src/app/donation/result/error.tsx`
- Create: `src/app/donation/result/result-page.test.tsx`
- Modify: `next.config.ts`
- Modify: `src/app/seo-routes.test.ts`

- [ ] **Step 1: Write failing result renderer tests**

Use async Next 16 `searchParams` and `renderDonationResultPage(params, deps?)`.
Cover missing/unknown ID → `notFound()`. Every record with provider ID, including
a locally terminal record, must call `reconcilePaymentById`. Cover reconciliation
to success/canceled/pending, a record without provider ID, a retryable provider
error shown as a distinct neutral technical-error state, and DB failure passed to
the local error boundary. Never label an unverified GET failure as ordinary
`PENDING`.

- [ ] **Step 2: Verify result RED**

Run: `npm test -- src/app/donation/result/result-page.test.tsx`

Expected: FAIL because the route is missing.

- [ ] **Step 3: Implement result views**

Render:
- success thank-you;
- canceled message and `/help` retry link;
- pending message and refresh action;
- technical verification error with a safe retry action;
- local 404 copy without identifiers;
- technical error boundary with `reset`.

Render `AttemptCleanup` only for verified terminal states and pass the local
`donationId` already present in the result URL. It removes sessionStorage only
when the stored donation marker matches; never serialize `idempotenceKey` into
RSC/HTML. Returning from an older payment must not erase a newer attempt. Add a
focused component test for matching/non-matching markers and a source assertion
that result components do not accept `idempotenceKey`.

- [ ] **Step 4: Add failing privacy/SEO tests**

Assert `dynamic = "force-dynamic"`, metadata `robots.index = false`, result is
absent from sitemap, and `next.config.ts` returns:

```ts
{
  source: "/donation/result",
  headers: [
    { key: "Cache-Control", value: "private, no-store, max-age=0" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "X-Content-Type-Options", value: "nosniff" },
  ],
}
```

- [ ] **Step 5: Implement headers and run tests**

Run:
`npm test -- src/app/donation/result/result-page.test.tsx src/app/seo-routes.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: production build succeeds.

### Task 14: Add CI Enforcement for PostgreSQL Payment Tests

**Files:**
- Create: `src/features/payments/ci-workflow.test.ts`
- Create: `.github/workflows/payments-integration.yml`

- [ ] **Step 1: Write a failing workflow contract test**

Read the workflow source and assert `pull_request` trigger, a PostgreSQL service,
database name ending `_test`, `npm ci`, `npx prisma migrate deploy`, and
`npm run test:integration:payments`. Assert both datasource env variables use
the same CI URL. Do not assert unrelated formatting.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/payments/ci-workflow.test.ts`

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Add CI PostgreSQL service**

Workflow steps and order:
1. trigger on every `pull_request` (optionally also push to `develop`);
2. checkout;
3. setup supported Node;
4. `npm ci`;
5. start PostgreSQL service with database `foundation_payments_test`;
6. set `DATABASE_URL` and `PAYMENTS_TEST_DATABASE_URL` to the exact same value;
7. `npx prisma migrate deploy`;
8. `npm run test:integration:payments`.

Do not add YooKassa secrets; the integration suite injects a fake HTTP client.

- [ ] **Step 4: Run workflow contract and integration suite**

Run: `npm test -- src/features/payments/ci-workflow.test.ts`

Expected: PASS.

Run with the same safe DB already used in Tasks 4–5:

```bash
PAYMENTS_TEST_DATABASE_URL="postgresql://localhost/foundation_payments_test" \
  DATABASE_URL="postgresql://localhost/foundation_payments_test" \
  npm run test:integration:payments
```

Expected: PASS, no skipped payment integration tests.

### Task 15: Run Full Regression and Update Operational Documentation

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_PLAN.md`
- Modify: `WORK_REPORT.md`
- Modify: relevant existing regression tests only if behavior intentionally changed

- [ ] **Step 1: Add failing documentation assertions where established**

Extend config/schema source tests to require all payment env names, the
integration command, webhook URL and the explicit note that production remains
disabled until the offer and real credentials are available.

- [ ] **Step 2: Update README and project records**

Document:
- required env variables and safe disabled default;
- create and webhook paths;
- YooKassa webhook events;
- migration deploy command;
- unit and mandatory integration commands;
- test-shop acceptance checklist;
- current blocker: no test `shopId`/`secretKey`, so dynamic QR and live webhook
  delivery remain unverified.

In `PROJECT_PLAN.md`, mark only implemented/tested subitems. Do not mark the whole
stage complete until a real test payment and webhook have been observed. Replace
the old Stage 4 form description (“необязательные имя и email”, plural mandatory
consents) with the approved anonymous scenario: no name/email/phone, only
acceptance of the published donation offer. Update the same statements anywhere
they occur in `README.md` or `WORK_REPORT.md`.

- [ ] **Step 3: Run focused payment suite**

Run: `npm test -- src/features/payments src/app/api/payments src/components/donation src/app/donation/result`

Expected: PASS.

- [ ] **Step 4: Run full static and unit verification**

Run sequentially:

```bash
npm test
npm run lint
npm run typecheck
npm run db:validate
npm run db:generate
npm run build
npm audit --audit-level=high
git diff --check
```

Expected: all exit 0. The default suite intentionally excludes only the payment
integration file; its mandatory result is verified separately.

- [ ] **Step 5: Run mandatory PostgreSQL integration verification again**

Run: `npm run test:integration:payments` with the safe DB env from Tasks 4–5.

Expected: PASS.

- [ ] **Step 6: Perform local browser verification with mocked provider**

Verify `/help` disabled by the real placeholder gate. In a test-only injected
configuration verify desktop/mobile layout, fixed/custom amounts, offer checkbox,
loading/error focus, terminal result views, no horizontal overflow and no console
errors. Never weaken the production gate or commit fake legal content to perform
this check.

## Deferred External Acceptance

After the owner supplies test-shop credentials and a reviewed published offer:

1. Change the legal source to `published` with its reviewed version.
2. Set matching `PAYMENTS_OFFER_VERSION` and `PAYMENTS_ENABLED=true`.
3. Register `payment.succeeded` and `payment.canceled` webhook URLs in ЮKassa.
4. Perform one successful and one canceled test payment.
5. Confirm dynamic QR, return page, webhook delivery, local DB status and admin
   list agree.
6. Only then mark all of Stage 4 complete.

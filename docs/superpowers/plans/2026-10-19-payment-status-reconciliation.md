# Payment Status Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically reconcile stuck `PENDING` donations with YooKassa so successful payments become `SUCCEEDED`, canceled payments become `CANCELED`, and failures are visible to administrators.

**Architecture:** Keep the existing webhook as the fast path, and add an idempotent server-side reconciliation service that fetches the current YooKassa state by `providerPaymentId`. Run it from a protected admin action for immediate recovery and from a scheduled maintenance endpoint/job for old pending records. Store the last reconciliation attempt and provider state so the process is observable without relying on short-lived platform logs.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, YooKassa REST client, Vitest.

---

## Scope and invariants

- Never mark a donation `SUCCEEDED` from a client redirect alone; only an authenticated YooKassa API response with `status=succeeded`, `paid=true`, valid `captured_at`, matching amount/currency, and matching metadata may do so.
- Reconciliation must be idempotent: rerunning it for an already terminal donation is a no-op.
- A provider/network failure must leave the donation status unchanged and record a retryable failure when the database is available. If the database itself is unavailable, return a retryable outcome without claiming metadata was persisted.
- The existing webhook path remains supported and uses the same reconciliation service.
- Do not expose YooKassa credentials or provider error bodies in the admin UI.

## File map

- Modify `prisma/schema.prisma`: add reconciliation observability fields/indexes, a short-lived claim lease, and `manualReviewRequired` to `Donation`.
- Create `prisma/migrations/<timestamp>_payment_reconciliation/migration.sql`: migrate those fields.
- Modify `src/features/payments/repository.ts`: query pending candidates and persist reconciliation metadata.
- Create `src/features/payments/reconcile-pending.ts`: bounded batch orchestration, locking/idempotency, and outcome aggregation.
- Modify `src/features/payments/reconcile.ts`: reuse existing verified status transition logic and normalize provider outcomes.
- Modify `src/app/api/payments/webhook/route.ts`: route webhook handling through the shared reconciliation path and preserve retry responses.
- Create `src/app/api/admin/payments/reconcile/route.ts`: authenticated admin endpoint for manual/batch reconciliation.
- Create `src/app/api/maintenance/payments/reconcile/route.ts`: secret-protected `POST` endpoint for the Timeweb scheduler.
- Create `src/app/api/maintenance/payments/reconcile/route.test.ts`: scheduler auth, idempotency, and response tests.
- Create `src/app/admin/(protected)/donations/reconcile-action.ts`: admin action for the UI.
- Modify `src/app/admin/(protected)/donations/donations-view.tsx`: add “Проверить зависшие” action and show last check/error summary.
- Modify `src/app/admin/(protected)/donations/donations-page.test.tsx`: cover the new action and feedback.
- Create `src/features/payments/reconcile-pending.test.ts`: cover selection, limits, idempotency, terminal states, and failures.
- Modify `src/features/payments/reconcile.test.ts`: cover metadata/status invariants and repeated reconciliation.
- Create `src/app/api/admin/payments/reconcile/route.test.ts`: cover auth, validation, batch limits, and response mapping.
- Modify `README.md`: document the scheduler/endpoint, required secret, and operational recovery procedure.
- Add a platform scheduler configuration only after the deployment target is confirmed; do not invent a provider-specific cron file in this plan.

### Task 1: Define database observability fields

**Files:** `prisma/schema.prisma`, new migration, `src/features/payments/repository.ts`, repository tests.

- [ ] Add nullable fields such as `lastProviderStatus`, `lastReconciledAt`, `lastReconcileErrorCode`, `nextReconcileAt`, `reconcileAttempts`, `claimToken`, and `claimExpiresAt`, plus `manualReviewRequired Boolean @default(false)`, to `Donation`.
- [ ] Add an index covering `status`, `nextReconcileAt`, and `createdAt`.
- [ ] Add repository methods to atomically claim bounded pending candidates with `nextReconcileAt IS NULL OR nextReconcileAt <= now`, a non-expired lease, and `FOR UPDATE SKIP LOCKED`/conditional updates; also persist the last provider result/error and release the lease.
- [ ] Write failing tests for `NULL`/due scheduling fields, stale/terminal exclusion, bounded ordering, and two workers competing for the same row.
- [ ] Run `npx vitest run src/features/payments/repository.test.ts` and verify the new tests fail before implementation.
- [ ] Implement an atomic lease protocol with a unique token and short expiry; make terminal transition return `{ kind: "updated" | "already-terminal" | "conflict" }` so webhook and batch races are explicit.
- [ ] Run the repository tests and `npm run db:validate`.
- [ ] Commit the schema/repository slice.

### Task 2: Extract a reusable reconciliation batch service

**Files:** `src/features/payments/reconcile-pending.ts`, `src/features/payments/reconcile.ts`, tests.

- [ ] Define a command accepting `limit`, `olderThan`, `maxAge`, `maxAttempts`, and an injected clock/client/repository for deterministic tests.
- [ ] Select only donations with `PENDING`, a non-null `providerPaymentId`, `manualReviewRequired=false`, due or `NULL` `nextReconcileAt`, and a non-expired claim. Exclude records older than `maxAge` or with `reconcileAttempts >= maxAttempts` from automatic retries, set `manualReviewRequired=true`, and preserve the financial status.
- [ ] For each candidate call the existing authenticated YooKassa GET flow; do not duplicate amount, metadata, currency, capture, or terminal-conflict validation.
- [ ] Transition only `PENDING → SUCCEEDED` or `PENDING → CANCELED`.
- [ ] On provider pending/unavailable/protocol/database errors, preserve `PENDING`, store a fixed error code when possible, increment attempts, release the claim, and calculate bounded exponential backoff. Store permanent validation failures as fixed non-retryable codes and exclude them from automatic retries for manual review.
- [ ] Write failing tests for successful payment recovery, cancellation, provider pending, provider failure, repeated terminal reconciliation, and batch limits.
- [ ] Implement and run `npx vitest run src/features/payments/reconcile-pending.test.ts src/features/payments/reconcile.test.ts`.
- [ ] Commit the reconciliation service slice.

### Task 3: Add protected manual reconciliation

**Files:** `src/app/api/admin/payments/reconcile/route.ts`, admin action/UI, route tests.

- [ ] Require the same admin session/access helper already used by donation pages; do not create a second auth mechanism.
- [ ] Support either a specific donation ID/provider payment ID or a bounded batch of stuck payments.
- [ ] Apply a hard server-side limit and return counts for `succeeded`, `canceled`, `pending`, `failed`, and `skipped`.
- [ ] Add an admin button labeled `Проверить зависшие` and show a non-sensitive result message after completion.
- [ ] Add an explicit admin retry action for a `manualReviewRequired` record that clears the flag, resets attempt/backoff fields, performs one bounded reconciliation, and audits the action.
- [ ] Add a per-row action for a known stuck donation if the existing table design supports it without widening the table excessively.
- [ ] Write failing tests for unauthenticated access, invalid input, successful recovery, and safe error output.
- [ ] Implement and run the focused admin tests plus `npm run typecheck`.
- [ ] Commit the manual recovery slice.

### Task 4: Add scheduled reconciliation

**Files:** scheduler configuration for the confirmed deployment target, route/handler tests, `README.md`.

- [ ] Production is documented as Timeweb Cloud App Platform; confirm its exact scheduler/cron capability before implementation. If it cannot invoke scheduled HTTP jobs, use one approved external scheduler owned by the project and document it; do not add a Vercel cron because Vercel is preview-only.
- [ ] Protect `POST /api/maintenance/payments/reconcile` with `PAYMENTS_RECONCILE_SECRET` and constant-time comparison; never reuse the admin browser session.
- [ ] Make the job process a small bounded batch, remain safe under retries, and return machine-readable counts.
- [ ] Schedule frequent checks for recent pending payments and slower checks for older pending payments. Define `maxAge` and `maxAttempts`; once exceeded, preserve `PENDING`, set `manualReviewRequired=true` with `manual_review_required` error code, and stop automatic retries until an administrator explicitly retries the record.
- [ ] Add tests for secret validation, batch limits, retry behavior, and duplicate scheduler invocations.
- [ ] Document deployment variables, scheduler URL/method, expected response, and rollback procedure.
- [ ] Run the scheduler/route tests and verify the endpoint does not disclose payment or customer data.
- [ ] Commit the scheduler slice.

### Task 5: Add durable operational visibility

**Files:** admin donation view/read model, alerts/readiness documentation, tests.

- [ ] Show last provider status, last checked time, and a concise retry/error state for pending rows.
- [ ] Add an admin dashboard alert when a pending donation is older than the configured threshold.
- [ ] Keep customer email and full provider IDs out of logs and alert messages unless already authorized in the admin UI.
- [ ] Add tests for Moscow-time formatting, stale-pending alert thresholds, and empty/error states.
- [ ] Add tests for the manual-review flag, explicit retry reset, and visibility of the fixed error code.
- [ ] Run the full suite, lint, typecheck, database validation, and production build.
- [ ] Commit the observability slice.

### Task 6: Recover the known payment and verify production

**Files:** no source changes; deployment/admin operations.

- [ ] Deploy the migration and application changes using the existing production procedure.
- [ ] Confirm production `DATABASE_URL`, YooKassa shop identity, amount, currency, metadata, and provider ID match the intended donation before running reconciliation for `323737db-000f-5000-b000-10514a4e0f12`.
- [ ] Run the manual reconciliation for that provider payment; if an invariant fails, do not force a status and escalate the fixed error code for manual review.
- [ ] Verify the admin table changes from `Ожидает` to `Успешно` and `paidAt` is populated.
- [ ] Verify a duplicate reconciliation does not change the record or create another donation.
- [ ] Verify a fresh test payment: creation, redirect, webhook, admin status, and result page.
- [ ] Record the final outcome and any payment-provider webhook delivery issue in the operational report.

## Verification commands

```bash
npm test
npm run lint
npm run typecheck
npm run db:validate
npm run build
```

Expected result: all tests pass, lint has no errors, typecheck/build succeed, and the known successful YooKassa payment is reconciled to `SUCCEEDED` without duplicate records.

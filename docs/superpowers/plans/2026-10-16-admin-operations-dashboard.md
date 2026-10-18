# Admin Operations Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the protected contact-request workflow, privacy-safe atomic audit log, dashboard read model, Moscow donation metrics, operational alerts, server-rendered badge, and release checks described by T1-T10.

**Architecture:** Keep reads and mutations in focused server-only feature modules. Prisma repositories own query shapes, audited mutations wrap existing content repositories in database transactions, and server components receive complete view models. Shared pure helpers define Moscow intervals, alert rules, validation, and audit-event derivation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Prisma 6, PostgreSQL, Vitest, Testing Library, axe-core.

---

## File map

- `prisma/schema.prisma` — statuses, note field, audit model, and Prisma indexes.
- `prisma/migrations/20261016000000_admin_operations/migration.sql` — backward-compatible SQL and trigram indexes.
- `src/lib/dates/moscow.ts` — Moscow calendar parsing and UTC intervals.
- `src/features/admin-messages/{types,filters,repository,mutation}.ts` — queue data and optimistic mutation.
- `src/features/admin-audit/{events,content-repository}.ts` — allow-listed events and atomic content wrappers.
- `src/features/admin-dashboard/{alerts,read-model}.ts` — alert rules and the dashboard loader.
- `src/features/readiness/evaluate.ts` — safe readiness result shared by route and dashboard.
- `src/app/admin/(protected)/messages/**` — server list/detail UI and action.
- `src/app/admin/(protected)/{page,layout,admin-shell,admin-nav}.tsx` — dashboard and server badge.
- `src/app/admin/admin.module.css` — responsive dashboard/message/badge styles.
- `src/db/admin-operations-migration*.test.ts` — SQL contract and local PostgreSQL verification.
- `README.md` and `WORK_REPORT.md` — operations documentation.

### Task 1: Data model and backward-compatible migration

**Files:**
- Modify: `src/db/schema.test.ts`
- Create: `src/db/admin-operations-migration.test.ts`
- Create: `src/db/admin-operations-migration.integration.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261016000000_admin_operations/migration.sql`

- [ ] **Step 1: Write failing schema and SQL-contract tests**

Require `SPAM`, `internalNote`, `AdminAuditEvent`, `Donation @@index([status, paidAt])`, `ContactRequest @@index([status, createdAt, id])`, and `@@index([createdAt, id])`. The SQL-contract test reads the migration and checks the enum alteration, nullable column, `pg_trgm`, audit table/enums, donation/contact indexes, and GIN indexes. Extract only the audit table definition before asserting it has no `name`, `email`, `message`, `internalNote`, or JSON payload.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/db/schema.test.ts src/db/admin-operations-migration.test.ts`

Expected: FAIL because the schema and migration do not exist.

- [ ] **Step 3: Add the minimal Prisma schema**

Add audit enums `AdminAuditActorKind { ADMIN }`, the seven approved actions, and entity types `PROJECT`, `NEWS_POST`, `DOCUMENT`, `CONTACT_REQUEST`. The model contains only `id`, `actorKind`, `action`, `entityType`, `entityId`, optional `previousStatus`/`nextStatus`, and `createdAt`, with indexes on `[createdAt, id]` and `[entityType, entityId, createdAt]`.

- [ ] **Step 4: Write migration SQL**

Preserve existing rows. Add `SPAM` and nullable `internalNote`, create audit enums/table/indexes, add `Donation(status, paidAt)`, replace the old contact index with `(status, createdAt, id)`, add `(createdAt, id)`, enable `pg_trgm`, and add GIN trigram indexes for `name`, `email`, and `message`. Do not backfill audit rows.

- [ ] **Step 5: Add isolated PostgreSQL migration verification**

Follow `src/db/content-migration.integration.test.ts`: require localhost and a database ending `_test`, create a random schema, create legacy tables/data, apply the migration through `psql -1`, and assert legacy rows/statuses survive, old notes are NULL, SPAM inserts work, audit columns are allow-listed, and every expected B-tree/GIN index exists. Always clean up.

- [ ] **Step 6: Generate Prisma and verify GREEN**

Run: `npm run db:generate && npm run db:validate && npm test -- src/db/schema.test.ts src/db/admin-operations-migration.test.ts`

Expected: PASS.

- [ ] **Step 7: Run DB-backed test when configured**

Run: `ADMIN_OPERATIONS_TEST_DATABASE_URL="$ADMIN_OPERATIONS_TEST_DATABASE_URL" npm test -- src/db/admin-operations-migration.integration.test.ts`

Expected with a safe configured database: PASS. If absent, report unavailable, not passed.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261016000000_admin_operations/migration.sql src/db/schema.test.ts src/db/admin-operations-migration.test.ts src/db/admin-operations-migration.integration.test.ts
git commit -m "feat: add admin operations data model"
```

### Task 2: Moscow boundaries and contact filters

**Files:**
- Create: `src/lib/dates/moscow.test.ts`
- Create: `src/lib/dates/moscow.ts`
- Create: `src/features/admin-messages/types.ts`
- Create: `src/features/admin-messages/filters.test.ts`
- Create: `src/features/admin-messages/filters.ts`

- [ ] **Step 1: Write failing Moscow-boundary tests**

Cover instants around Moscow midnight, month/year rollover, leap day, invalid dates, inclusive same-day ranges, and reversed ranges. Desired APIs: `parseCalendarDate`, `moscowStartOfDate`, `moscowDateRange`, `moscowDayInterval`, and `moscowMonthInterval`.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/lib/dates/moscow.test.ts`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement date helpers**

Use `Intl.DateTimeFormat` with `Europe/Moscow` and iterative offset resolution. Return half-open UTC intervals and never use host-local dates.

- [ ] **Step 4: Run date tests and verify GREEN**

Run: `npm test -- src/lib/dates/moscow.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing filter tests**

Test absent filters, duplicate values, all four statuses, invalid/impossible/reversed dates, query length 120/121, valid/invalid pages, and query reconstruction. Assert `buildContactWhere` emits case-insensitive `contains` across name/email/message plus half-open `createdAt`.

- [ ] **Step 6: Run filters and verify RED**

Run: `npm test -- src/features/admin-messages/filters.test.ts`

Expected: FAIL because parser/builders are absent.

- [ ] **Step 7: Implement filter types/parser/builders**

Mirror the donation-filter pattern while reusing the shared Moscow helper. Export `parseContactPageFilters`, `buildContactWhere`, and `buildContactQuery`. Use a six-digit positive page and 120-character query.

- [ ] **Step 8: Verify and commit**

Run: `npm test -- src/lib/dates/moscow.test.ts src/features/admin-messages/filters.test.ts`

Expected: PASS.

```bash
git add src/lib/dates src/features/admin-messages/types.ts src/features/admin-messages/filters.ts src/features/admin-messages/filters.test.ts
git commit -m "feat: validate Moscow message filters"
```

### Task 3: Paginated contact repository

**Files:**
- Create: `src/features/admin-messages/repository.test.ts`
- Create: `src/features/admin-messages/repository.ts`
- Modify: `src/features/contact/repository.ts`

- [ ] **Step 1: Write failing repository tests**

Test one repeatable-read transaction containing `count` and `findMany`, page size 25, stable descending `createdAt/id` order, narrow list/detail selects, page clamping, and zero results returning page 1/totalPages 1. Test `countNewContactRequests()` and `getAdminContactRequest(id)` query shapes.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/admin-messages/repository.test.ts`

Expected: FAIL because the repository is absent.

- [ ] **Step 3: Implement repository**

Export `CONTACT_PAGE_SIZE = 25`, `getContactRequestPage`, `getAdminContactRequest`, and `countNewContactRequests`. Remove obsolete `listContactRequests` only after its call site is replaced; do not alter public submission storage.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/features/admin-messages/repository.test.ts src/features/contact/submit.test.ts`

Expected: PASS.

```bash
git add src/features/admin-messages/repository.ts src/features/admin-messages/repository.test.ts src/features/contact/repository.ts
git commit -m "feat: page contact requests on server"
```

### Task 4: Contact mutation and audit

**Files:**
- Create: `src/features/admin-audit/events.test.ts`
- Create: `src/features/admin-audit/events.ts`
- Create: `src/features/admin-messages/mutation.test.ts`
- Create: `src/features/admin-messages/mutation.ts`
- Create: `src/app/admin/(protected)/messages/actions.test.ts`
- Create: `src/app/admin/(protected)/messages/actions.ts`
- Modify: `src/features/contact/submit.test.ts`

- [ ] **Step 1: Write failing event tests**

Test contact status changed, note changed, both, and no-op. Inputs/outputs expose only entity ID and statuses. Serialized events must not contain `name`, `email`, `message`, `note`, or `secret`.

- [ ] **Step 2: Run RED, implement allow-listed constructors, rerun GREEN**

Run: `npm test -- src/features/admin-audit/events.test.ts`

Expected: initial FAIL, then PASS.

- [ ] **Step 3: Write failing mutation tests**

Cover status validation, note trim/null, 4,000/4,001 characters, invalid/future `updatedAt`, missing row, stale conflict, no-op, atomic update plus audit `createMany`, and audit failure propagation. The repository compares the full current note but gives event constructors only `noteChanged`.

- [ ] **Step 4: Run and verify RED**

Run: `npm test -- src/features/admin-messages/mutation.test.ts`

Expected: FAIL because mutation code is absent.

- [ ] **Step 5: Implement mutation**

Export `parseContactMutation`, `updateContactRequest`, and `updateContactRequestMutation`. Authenticate before parsing. In one transaction: `findUnique`, no-op return, `updateMany({ where: { id, updatedAt } })`, then audit `createMany`. Initial lookup distinguishes missing/conflict.

- [ ] **Step 6: Add action and auth-boundary tests**

Bind ID in the server action signature rather than trusting a hidden field. Test rejected session prevents parse/repository work, safe validation/conflict state, revalidation of `/admin` and `/admin/messages`, and redirect on success.

- [ ] **Step 7: Prove public submissions never audit**

Extend the public save test with an audit delegate that throws if touched; successful submission must only consume buckets and create `ContactRequest`.

- [ ] **Step 8: Verify and commit**

Run: `npm test -- src/features/admin-audit/events.test.ts src/features/admin-messages/mutation.test.ts 'src/app/admin/(protected)/messages/actions.test.ts' src/features/contact/submit.test.ts`

Expected: PASS.

```bash
git add src/features/admin-audit src/features/admin-messages/mutation.ts src/features/admin-messages/mutation.test.ts 'src/app/admin/(protected)/messages/actions.ts' 'src/app/admin/(protected)/messages/actions.test.ts' src/features/contact/submit.test.ts
git commit -m "feat: update and audit contact requests"
```

### Task 5: Atomic content lifecycle audit

**Files:**
- Modify: `src/features/content-admin/repository.ts`
- Modify: `src/features/content-admin/repository.test.ts`
- Create: `src/features/admin-audit/content-repository.test.ts`
- Create: `src/features/admin-audit/content-repository.ts`
- Modify: `src/app/admin/(protected)/content-actions.ts`
- Modify: `src/app/admin/(protected)/content-actions.test.ts`

- [ ] **Step 1: Add failing lifecycle-event tests**

Cover create-draft, create-published (created + published), create-archived
(created + archived), publish, archive, other transition, unchanged status, and
delete for project/news/document.

- [ ] **Step 2: Verify RED, implement, verify GREEN**

Run: `npm test -- src/features/admin-audit/events.test.ts`

- [ ] **Step 3: Expose exact status transitions**

Write repository tests first, then add `previousStatus` and `status` to successful create/update results while preserving published timestamps, duplicates, conflicts, and delete rules. Keep narrow delegate injection so transaction delegates work.

- [ ] **Step 4: Write failing audited-wrapper tests**

For every create/update/delete wrapper assert one Prisma transaction, use of the correct transaction delegate, and `adminAuditEvent.createMany`. Error/conflict/duplicate/forbidden results create no events; audit failure rejects the transaction.

- [ ] **Step 5: Implement explicit audited wrappers**

Export `createAuditedProject`, `updateAuditedProject`, etc. Prefer small explicit wrappers over type-obscuring metaprogramming.

- [ ] **Step 6: Switch actions and verify authorization**

Change server-action imports to audited wrappers. Keep session checks in mutation orchestration and leave requisites unchanged. Prove unauthenticated actions never reach wrappers.

- [ ] **Step 7: Run regressions and commit**

Run: `npm test -- src/features/content-admin/repository.test.ts src/features/admin-audit/content-repository.test.ts 'src/app/admin/(protected)/content-actions.test.ts' src/features/content-admin/mutations.test.ts`

Expected: PASS.

```bash
git add src/features/content-admin/repository.ts src/features/content-admin/repository.test.ts src/features/admin-audit/content-repository.ts src/features/admin-audit/content-repository.test.ts 'src/app/admin/(protected)/content-actions.ts' 'src/app/admin/(protected)/content-actions.test.ts'
git commit -m "feat: audit content lifecycle atomically"
```

### Task 6: Readiness and pure alert rules

**Files:**
- Create: `src/features/readiness/evaluate.test.ts`
- Create: `src/features/readiness/evaluate.ts`
- Create: `src/features/admin-dashboard/alerts.test.ts`
- Create: `src/features/admin-dashboard/alerts.ts`
- Modify: `src/app/api/ready/route.ts`
- Modify: `src/app/api/ready/route.test.ts`

- [ ] **Step 1: Write failing readiness tests**

Test valid config => `{ ok: true, issues: [] }`, `AdminAuthConfigurationError` => `{ ok: false, issues: ["ADMIN_AUTH"] }`, no exposed values, and unexpected error propagation.

- [ ] **Step 2: Implement evaluator and preserve route compatibility**

Run before/after: `npm test -- src/features/readiness/evaluate.test.ts src/app/api/ready/route.test.ts`

Keep private JSON, status 200/503, and exact public body `{ ok }`.

- [ ] **Step 3: Write failing alert tests**

Cover zero/nonzero stale counts and readiness codes. Test cutoff equality to prove exactly 48 hours and 1 hour do not qualify under repository `lt` predicates.

- [ ] **Step 4: Implement alert helpers**

Export `staleContactCutoff`, `staleDonationCutoff`, and `buildOperationalAlerts`. Accept only counts and safe codes, never rows or PII.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/features/readiness/evaluate.test.ts src/features/admin-dashboard/alerts.test.ts src/app/api/ready/route.test.ts`

Expected: PASS.

```bash
git add src/features/readiness src/features/admin-dashboard/alerts.ts src/features/admin-dashboard/alerts.test.ts src/app/api/ready/route.ts src/app/api/ready/route.test.ts
git commit -m "feat: evaluate admin operational alerts"
```

### Task 7: Dashboard read model and donation metrics

**Files:**
- Create: `src/features/admin-dashboard/read-model.test.ts`
- Create: `src/features/admin-dashboard/read-model.ts`
- Modify: `src/app/admin/(protected)/page.tsx`
- Create: `src/app/admin/(protected)/admin-dashboard.test.tsx`

- [ ] **Step 1: Write failing query-shape tests**

Freeze time around Moscow midnight/month rollover. Assert one repeatable-read transaction queries NEW count, stale NEW before 48-hour cutoff, stale PENDING before 1-hour cutoff, two SUCCEEDED/`paidAt` aggregates for day/month, and 20 safe audit rows ordered by `createdAt/id DESC`. Assert null sums become zero.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/admin-dashboard/read-model.test.ts`

Expected: FAIL because the loader is absent.

- [ ] **Step 3: Implement the single loader**

Export `getAdminDashboardReadModel(now = new Date(), dependencies?)`. Select only audit `id/action/entityType/entityId/previousStatus/nextStatus/createdAt`. Return typed messages, today/month donation metrics, alerts, and recent activity. Evaluate readiness safely outside the transaction.

- [ ] **Step 4: Write failing dashboard tests**

Test session enforcement before loading, Russian ruble totals/counts, empty activity, warnings, safe activity labels, section links, and axe serious/critical results.

- [ ] **Step 5: Implement dashboard page**

Make the overview async; authenticate, call one read model, and render metric cards, alerts, recent activity, and existing section navigation. Do not reveal raw contact data or entity IDs in visible activity text.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/features/admin-dashboard/read-model.test.ts 'src/app/admin/(protected)/admin-dashboard.test.tsx'`

Expected: PASS.

```bash
git add src/features/admin-dashboard/read-model.ts src/features/admin-dashboard/read-model.test.ts 'src/app/admin/(protected)/page.tsx' 'src/app/admin/(protected)/admin-dashboard.test.tsx'
git commit -m "feat: add admin dashboard read model"
```

### Task 8: Server-rendered NEW badge

**Files:**
- Modify: `src/app/admin/(protected)/layout.tsx`
- Modify: `src/app/admin/(protected)/admin-shell.tsx`
- Modify: `src/app/admin/(protected)/admin-nav.tsx`
- Modify: `src/app/admin/(protected)/admin-shell.test.tsx`
- Modify: `src/app/admin/(protected)/admin-nav.test.ts`

- [ ] **Step 1: Write failing shell/nav tests**

Test authentication before `countNewContactRequests`, number-only prop flow, no badge at zero, accessible badge at three, and no client fetch. An unauthenticated layout must leave count untouched.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- 'src/app/admin/(protected)/admin-shell.test.tsx' 'src/app/admin/(protected)/admin-nav.test.ts'`

- [ ] **Step 3: Implement server badge flow**

After session validation load the count and pass `newContactRequestCount` through shell/nav. Render only next to messages. Add no endpoint and no network effect.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- 'src/app/admin/(protected)/admin-shell.test.tsx' 'src/app/admin/(protected)/admin-nav.test.ts' src/lib/admin-auth/session-access.test.ts`

Expected: PASS.

```bash
git add 'src/app/admin/(protected)/layout.tsx' 'src/app/admin/(protected)/admin-shell.tsx' 'src/app/admin/(protected)/admin-nav.tsx' 'src/app/admin/(protected)/admin-shell.test.tsx' 'src/app/admin/(protected)/admin-nav.test.ts'
git commit -m "feat: show server message badge"
```

### Task 9: Contact list and edit UI

**Files:**
- Modify: `src/app/admin/(protected)/messages/page.tsx`
- Create: `src/app/admin/(protected)/messages/messages-view.tsx`
- Create: `src/app/admin/(protected)/messages/[id]/page.tsx`
- Create: `src/app/admin/(protected)/messages/message-form.tsx`
- Create: `src/app/admin/(protected)/messages/messages-page.test.tsx`
- Create: `src/app/admin/(protected)/messages/message-form.test.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `src/app/admin/admin-accessibility.test.tsx`
- Modify: `src/app/admin/admin-styles.test.ts`

- [ ] **Step 1: Write failing list-page tests**

Test auth before parsing/loading, invalid filters, normalized page redirect, total/page summary, SPAM, form defaults, page links, empty results, and detail links. List rendering must not include `internalNote`.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- 'src/app/admin/(protected)/messages/messages-page.test.tsx'`

Expected: FAIL against the old 100-row list.

- [ ] **Step 3: Implement server list/view**

Use the dependency-injected donation-page pattern: authenticate, parse, load, redirect normalized pages, render responsive filters/results/pagination with page size 25.

- [ ] **Step 4: Write failing detail/form tests**

Test protected lookup, `notFound`, contact display, four statuses, private note max 4,000, updatedAt token, validation/conflict preservation, success state, and axe results.

- [ ] **Step 5: Implement detail page and form**

Bind action ID server-side, use `useActionState`, preserve submitted status/note after safe errors, and keep PII confined to the authenticated detail page.

- [ ] **Step 6: Add responsive styles**

Add filter grid, result cards/table, SPAM badge, note form, nav badge, metric cards, alerts, and activity list. At <=720px stack controls and prevent horizontal page overflow.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- 'src/app/admin/(protected)/messages/messages-page.test.tsx' 'src/app/admin/(protected)/messages/message-form.test.tsx' src/app/admin/admin-accessibility.test.tsx src/app/admin/admin-styles.test.ts`

Expected: PASS.

```bash
git add 'src/app/admin/(protected)/messages' src/app/admin/admin.module.css src/app/admin/admin-accessibility.test.tsx src/app/admin/admin-styles.test.ts
git commit -m "feat: manage contact request queue"
```

### Task 10: Integration, documentation, and release review

**Files:**
- Create: `src/features/admin-operations.integration.test.ts`
- Modify: `README.md`
- Modify: `WORK_REPORT.md`
- Modify as findings require: files from Tasks 1-9

- [ ] **Step 1: Write an application-level PostgreSQL integration test**

Use `ADMIN_OPERATIONS_TEST_DATABASE_URL` with the same localhost/`_test` safety
guard and random-schema cleanup as the migration test. Apply all migrations to the
isolated schema, create a Prisma client whose datasource URL selects that schema,
and exercise the real repositories with injected clients:

- contact search across name/email/message plus status and Moscow date filters;
- result counts and page-size SQL;
- SUCCEEDED donation count/sum immediately before, at, and after Moscow day/month
  boundaries, proving `[start, end)` and use of `paidAt`;
- NEW-at-48-hours and PENDING-at-1-hour strict alert boundaries;
- contact status/note mutation and content create/publish/archive/delete wrappers;
- audit rows contain the expected action/entity/status fields and no payload capable
  of storing contact PII, note text, content text, or secrets;
- public contact storage creates no audit row.

The test must fail on incorrect predicates or non-atomic audit behavior; it must not
reimplement application SQL as raw fixture assertions.

- [ ] **Step 2: Run the integration test and verify RED/GREEN**

Run after writing the test, before any integration-specific repair:

`ADMIN_OPERATIONS_TEST_DATABASE_URL="$ADMIN_OPERATIONS_TEST_DATABASE_URL" npm test -- src/features/admin-operations.integration.test.ts`

Expected RED: at least one intended integration path is missing or miswired.
Implement only the necessary client-injection seams or fixes, then rerun and expect
PASS. If the safe URL is unavailable, keep the test committed and record the run as
unavailable rather than passing.

- [ ] **Step 3: Record the T1-T10 verification matrix**

Map every requirement to tests in `WORK_REPORT.md`. Confirm each protected action has an unauthenticated test, public submission has a no-audit regression, and audit inserts/selects are allow-listed.

- [ ] **Step 4: Run full unit suite**

Run: `npm test`

Expected: configured tests PASS; DB-gated tests may be skipped only when their environment variables are absent.

- [ ] **Step 5: Run static/build verification**

Run: `npm run lint && npm run typecheck && npm run db:validate && npm run build && git diff --cached --check && git diff --check`

Expected: all exit 0.

- [ ] **Step 6: Run DB-backed checks when safe URLs exist**

```bash
ADMIN_OPERATIONS_TEST_DATABASE_URL="$ADMIN_OPERATIONS_TEST_DATABASE_URL" npm test -- src/db/admin-operations-migration.integration.test.ts
ADMIN_OPERATIONS_TEST_DATABASE_URL="$ADMIN_OPERATIONS_TEST_DATABASE_URL" npm test -- src/features/admin-operations.integration.test.ts
CONTENT_MIGRATION_TEST_DATABASE_URL="$CONTENT_MIGRATION_TEST_DATABASE_URL" npm test -- src/db/content-migration.integration.test.ts
PAYMENTS_TEST_DATABASE_URL="$PAYMENTS_TEST_DATABASE_URL" npm run test:integration:payments
```

Record unavailable prerequisites explicitly.

- [ ] **Step 7: Review SQL/query plans**

Inspect generated predicates and, with PostgreSQL, run `EXPLAIN` for pagination, trigram search, paid-time aggregates, NEW count, and stale pending queries. Confirm intended B-tree/GIN indexes are eligible; change only measured problems.

- [ ] **Step 8: Perform security review**

Run `npm audit --omit=dev` and `npm audit`. Classify production reachability; do not use `--force`. Inspect schema, event constructors, dashboard select, errors, URLs, fixtures, and protected cache rules for PII/secrets.

- [ ] **Step 9: Desktop/mobile smoke test**

Using a safe local database and production build, verify at 1440px and 390px: login, counters, warnings/activity, badge, filters, pagination, detail update, conflict, SPAM, keyboard focus, no horizontal overflow, and no console errors. Remove smoke fixtures.

- [ ] **Step 10: Update documentation**

Document migration, integration variable, 25-row queue, private notes, audit privacy boundary, Moscow metrics, alerts, and production suppression of `/admin` query strings. Add a dated work report.

- [ ] **Step 11: Run final verification**

Run: `npm run verify`

Expected: PASS. Then inspect `git status --short` for only intentional files.

- [ ] **Step 12: Commit**

```bash
git add src/features/admin-operations.integration.test.ts README.md WORK_REPORT.md
git commit -m "docs: record admin operations release"
```

- [ ] **Step 13: Request final review**

Use `superpowers:requesting-code-review` on the full branch diff. Address verified findings, rerun relevant tests, then rerun `npm run verify` before any completion claim.

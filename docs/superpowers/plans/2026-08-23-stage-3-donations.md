# Admin Donations List and CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Завершить третий пункт этапа 3 защищенным списком пожертвований, серверными фильтрами, пагинацией и потоковым CSV-экспортом текущей выборки.

**Architecture:** Чистые модули разбирают URL-фильтры и форматируют значения, репозиторий изолирует Prisma-запросы, а серверные страницы и route handler сначала проверяют admin-сессию. HTML получает одну страницу данных; CSV читает ту же выборку пакетами по ручному keyset и отдает ее через pull-based `ReadableStream`.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript, Prisma 6/PostgreSQL, Vitest, Testing Library, lucide-react.

---

## File Structure

- `prisma/schema.prisma`: индекс для стабильного списка и keyset-экспорта.
- `prisma/migrations/20260823010000_donation_list_index/migration.sql`: SQL индекса.
- `src/lib/db.ts`: единый Prisma Client с development-кешированием.
- `src/features/admin-donations/types.ts`: минимальные типы строк, фильтров и курсора.
- `src/features/admin-donations/filters.ts`: строгий HTML/CSV-разбор query-параметров и Prisma `where`.
- `src/features/admin-donations/format.ts`: московские даты, деньги, статусы.
- `src/features/admin-donations/repository.ts`: транзакционная страница и keyset-пакеты.
- `src/features/admin-donations/csv.ts`: детерминированные CSV-строки и защита от формул.
- `src/features/admin-donations/export-stream.ts`: первый пакет до ответа и pull-based поток.
- `src/app/admin/(protected)/donations/page.tsx`: auth-first orchestration страницы.
- `src/app/admin/(protected)/donations/donations-view.tsx`: форма, таблица, пагинация и пустые состояния.
- `src/app/admin/(protected)/donations/export/route.ts`: защищенный CSV route.
- `src/app/admin/(protected)/donations/error.tsx`: локальная нейтральная ошибка.
- `src/app/admin/(protected)/page.tsx`: ссылка из админского экрана.
- `src/app/admin/admin.module.css`: адаптивный рабочий интерфейс без вложенных карточек.
- `next.config.ts`: no-store и referrer headers для `/admin`.
- Tests colocated beside the modules and routes they cover.

### Task 1: Add the Donation Query Index and Prisma Client

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260823010000_donation_list_index/migration.sql`
- Create: `src/lib/db.ts`
- Create: `src/lib/db.test.ts`
- Modify: `src/db/schema.test.ts`

- [ ] **Step 1: Write failing schema and singleton tests**

Assert that `Donation` contains `@@index([createdAt, id])`, the migration creates
`Donation_createdAt_id_idx`, and repeated imports expose one typed client.

```ts
expect(schema).toContain("@@index([createdAt, id])");
expect(migration).toContain(
  'CREATE INDEX "Donation_createdAt_id_idx" ON "Donation"("createdAt", "id")',
);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/db/schema.test.ts src/lib/db.test.ts`

Expected: FAIL because the index, migration and `db.ts` do not exist.

- [ ] **Step 3: Add the index, SQL migration and singleton**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

The migration contains only the new index and does not rewrite the initial
migration.

- [ ] **Step 4: Verify schema and generated client**

Run: `npm test -- src/db/schema.test.ts src/lib/db.test.ts`

Expected: PASS.

Run: `npm run db:validate`

Expected: schema is valid.

Run: `npm run db:generate`

Expected: Prisma Client generated successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma src/lib/db.ts src/lib/db.test.ts src/db/schema.test.ts
git commit -m "feat: index admin donation queries"
```

### Task 2: Parse Donation Filters and Format Values

**Files:**
- Create: `src/features/admin-donations/types.ts`
- Create: `src/features/admin-donations/filters.ts`
- Create: `src/features/admin-donations/filters.test.ts`
- Create: `src/features/admin-donations/format.ts`
- Create: `src/features/admin-donations/format.test.ts`

- [ ] **Step 1: Write failing filter tests**

Cover valid status/from/to/q/page, blank-as-absent, duplicate rejection in the
current parser mode, ignored export page, impossible dates, `from > to`, `q`
length 121, and page forms `0`, `01`, `1.5`, `1e2`, `1000000`.

```ts
expect(parseDonationPageFilters(new URLSearchParams("status=SUCCEEDED&page=2")))
  .toMatchObject({ ok: true, value: { status: "SUCCEEDED", page: 2 } });
expect(parseDonationExportFilters(new URLSearchParams("page=x&page=y"))).toMatchObject({ ok: true });
```

Assert Moscow bounds for `2026-08-23` are `2026-08-22T21:00:00.000Z` through
`2026-08-23T21:00:00.000Z` and that `to` uses `<`.

- [ ] **Step 2: Run filter tests and verify RED**

Run: `npm test -- src/features/admin-donations/filters.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict parsers and query serialization**

Expose:

```ts
parseDonationPageFilters(input): ParseResult<DonationPageFilters>
parseDonationExportFilters(input): ParseResult<DonationExportFilters>
buildDonationWhere(filters): Prisma.DonationWhereInput
buildDonationQuery(filters, options?): URLSearchParams
```

Use a small `SearchParamsSource` adapter so both Next page objects and
`URLSearchParams` preserve duplicate detection. Keep the IANA timezone constant
in this module and perform strict round-trip validation of date parts.

- [ ] **Step 4: Write failing formatter tests**

Cover exact kopeck formatting, non-RUB currency, all three Russian status labels,
nullable values and Moscow timestamps including the offset.

- [ ] **Step 5: Implement formatters**

Expose `formatDonationAmount`, `formatDonationDateTime`,
`formatDonationCsvDateTime`, and `DONATION_STATUS_LABELS`. Build the decimal
amount from integer division/remainder, not floating-point rounding.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- src/features/admin-donations/filters.test.ts src/features/admin-donations/format.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin-donations
git commit -m "feat: parse admin donation filters"
```

### Task 3: Implement the Donation Repository

**Files:**
- Create: `src/features/admin-donations/repository.ts`
- Create: `src/features/admin-donations/repository.test.ts`

- [ ] **Step 1: Write failing page-query tests**

Use an injected Prisma-shaped dependency. Assert `count` and `findMany` execute
inside `$transaction(..., { isolationLevel: "RepeatableRead" })`, page size is
50, order is `createdAt desc, id desc`, page is clamped after count, and zero
results resolve to page 1 without unsafe `skip`.

- [ ] **Step 2: Run repository test and verify RED**

Run: `npm test -- src/features/admin-donations/repository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement page access**

```ts
export async function getDonationPage(
  filters: DonationPageFilters,
  client: DonationPrismaClient = prisma,
): Promise<DonationPageResult>
```

Select only fields required by the table/export. Compute `totalPages`, resolved
page and `skip` inside the transaction callback.

- [ ] **Step 4: Write failing keyset batch tests**

Assert the first batch uses only base filters. Assert the second adds:

```ts
OR: [
  { createdAt: { lt: cursor.createdAt } },
  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
]
```

Cover equal timestamps at a batch boundary and verify no duplicate or omitted ID.

- [ ] **Step 5: Implement batch access**

```ts
export async function getDonationExportBatch(
  filters: DonationExportFilters,
  cursor: DonationCursor | null,
  limit = 1000,
  client: DonationReadClient = prisma,
): Promise<{ rows: DonationRow[]; nextCursor: DonationCursor | null }>
```

Return `nextCursor` only when `rows.length === limit`.

- [ ] **Step 6: Run repository tests and commit**

Run: `npm test -- src/features/admin-donations/repository.test.ts`

Expected: PASS.

```bash
git add src/features/admin-donations/repository.ts src/features/admin-donations/repository.test.ts
git commit -m "feat: query filtered donations"
```

### Task 4: Build Safe CSV Rows and a Bounded Stream

**Files:**
- Create: `src/features/admin-donations/csv.ts`
- Create: `src/features/admin-donations/csv.test.ts`
- Create: `src/features/admin-donations/export-stream.ts`
- Create: `src/features/admin-donations/export-stream.test.ts`

- [ ] **Step 1: Write failing CSV tests**

Assert exact ten-column header order, BOM, semicolon separator, quoted cells,
doubled quotes, CRLF, empty nulls, Russian decimal comma and header-only output.
Test formula prefixes `=`, `+`, `-`, `@`, leading spaces before them, and leading
tab/CR/LF.

- [ ] **Step 2: Implement deterministic CSV encoding**

Expose `DONATION_CSV_HEADER`, `encodeDonationCsvHeader()` and
`encodeDonationCsvRows(rows)`. Apply formula neutralization only to untrusted
text columns, then quote every value.

- [ ] **Step 3: Run CSV tests**

Run: `npm test -- src/features/admin-donations/csv.test.ts`

Expected: PASS.

- [ ] **Step 4: Write failing stream tests**

Cover first-batch failure before `Response`, a 1001-row/two-batch export,
one-batch-at-a-time backpressure, `cancel()` preventing another fetch, and a late
fetch error rejecting the reader.

- [ ] **Step 5: Implement pull-based stream factory**

```ts
export async function createDonationCsvStream(input: {
  filters: DonationExportFilters;
  fetchBatch: DonationBatchFetcher;
}): Promise<ReadableStream<Uint8Array>>
```

Fetch the first batch before constructing the stream. Enqueue only header plus
the current batch. Fetch a later batch only from `pull()`. Keep a canceled flag
and call `controller.error(error)` for late failures.

- [ ] **Step 6: Run stream tests and commit**

Run: `npm test -- src/features/admin-donations/csv.test.ts src/features/admin-donations/export-stream.test.ts`

Expected: PASS.

```bash
git add src/features/admin-donations/csv.ts src/features/admin-donations/csv.test.ts src/features/admin-donations/export-stream.ts src/features/admin-donations/export-stream.test.ts
git commit -m "feat: stream safe donation CSV"
```

### Task 5: Add the Protected Donations Page

**Files:**
- Create: `src/app/admin/(protected)/donations/page.tsx`
- Create: `src/app/admin/(protected)/donations/donations-view.tsx`
- Create: `src/app/admin/(protected)/donations/error.tsx`
- Create: `src/app/admin/(protected)/donations/donations-page.test.tsx`
- Modify: `src/app/admin/(protected)/page.tsx`
- Modify: `src/app/admin/admin.module.css`

- [ ] **Step 1: Write failing orchestration and view tests**

Mock session, parser and repository. Assert unauthorized execution never calls
the parser/repository, invalid filters never query, excessive pages redirect to a
canonical URL, and valid filters reach the repository.

Render `DonationsView` and assert labels, six columns, status text, currency,
empty state, preserved filter links, pagination boundaries, export query without
`page`, and `prefetch={false}`.

- [ ] **Step 2: Run page tests and verify RED**

Run: `npm test -- src/app/admin/(protected)/donations/donations-page.test.tsx`

Expected: FAIL because the route and view do not exist.

- [ ] **Step 3: Implement auth-first page orchestration**

```ts
export const dynamic = "force-dynamic";

export default async function DonationsPage({ searchParams }) {
  await requireAdminSession();
  const parsed = parseDonationPageFilters(await searchParams);
  // invalid state, repository call, canonical redirect, then view
}
```

Keep the page thin; all display markup lives in `donations-view.tsx`.

- [ ] **Step 4: Implement the operational UI**

Use lucide `Search`, `X`, `Download`, `ChevronLeft`, `ChevronRight` icons. Build a
dense unframed admin layout, GET filter controls, horizontally scrollable table,
empty state and stable pagination. Add a «Пожертвования» navigation command to
the existing dashboard and replace the obsolete next-slice note.

- [ ] **Step 5: Implement local error boundary**

Create a client error component with neutral copy and a retry button using
`reset()`. Do not render Prisma messages.

- [ ] **Step 6: Run page/accessibility tests**

Run: `npm test -- src/app/admin`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin
git commit -m "feat: add admin donations list"
```

### Task 6: Add the Protected CSV Route and Privacy Headers

**Files:**
- Create: `src/app/admin/(protected)/donations/export/route.ts`
- Create: `src/app/admin/(protected)/donations/export/route.test.ts`
- Modify: `next.config.ts`
- Create or Modify: `src/app/admin/admin-headers.test.ts`

- [ ] **Step 1: Write failing route tests**

Assert auth runs before parser/fetcher, unauthorized requests never parse/query,
invalid filters return 400, first-batch failures return neutral 500, and success
returns the exact CSV/privacy headers. Freeze time and assert
`filename="donations-2026-08-23.csv"` in Moscow.

- [ ] **Step 2: Run route tests and verify RED**

Run: `npm test -- src/app/admin/(protected)/donations/export/route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement route with injectable core**

Export a testable `handleDonationExport(request, dependencies)` plus `GET`.
Sequence: require session, parse export filters, fetch/create stream, build
headers. Catch only parsing and pre-stream repository failures; do not expose
error details.

- [ ] **Step 4: Add global admin response headers**

Extend `next.config.ts` `headers()` for `/admin/:path*` with:

```ts
[
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
]
```

- [ ] **Step 5: Run route/header tests and commit**

Run: `npm test -- src/app/admin/(protected)/donations/export/route.test.ts src/app/admin/admin-headers.test.ts`

Expected: PASS.

```bash
git add next.config.ts src/app/admin
git commit -m "feat: protect donation exports"
```

### Task 7: Verify the Complete Third Stage Item

**Files:**
- Modify: `README.md`
- Modify: `WORK_REPORT.md`
- Modify: `PROJECT_PLAN.md`

- [ ] **Step 1: Update project documentation**

Document `/admin/donations`, filtered CSV behavior, Moscow date semantics and the
required migration command. Mark only the three Stage 3 bullets complete; do not
claim the payment stage is implemented.

- [ ] **Step 2: Run focused and full automated checks**

Run each command separately:

```bash
npm test -- src/features/admin-donations src/app/admin
npm test
npm run lint
npm run typecheck
npm run db:validate
npm run db:generate
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Verify migration when PostgreSQL is available**

Run `npx prisma migrate deploy` only against the configured local/disposable
database. Do not target a production database. If unavailable, record that exact
gap in the final report.

- [ ] **Step 4: Run browser QA**

Using the confirmed local admin credentials, verify:

- dashboard navigation to `/admin/donations`;
- desktop 1440×900 and mobile 390×844 without page overflow or overlap;
- filters preserve values and reset page;
- empty state and pagination controls;
- CSV request preserves filters, omits page, downloads with correct headers;
- logout and unauthorized page/export protection;
- browser console has no new errors.

- [ ] **Step 5: Request code review and fix findings**

Invoke `superpowers:requesting-code-review` for the implementation range. Fix
Critical/Important findings with focused regression tests, then rerun the full
verification suite.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md WORK_REPORT.md PROJECT_PLAN.md
git commit -m "docs: complete stage 3 donations tooling"
```

- [ ] **Step 7: Finish the branch**

Invoke `superpowers:verification-before-completion` and
`superpowers:finishing-a-development-branch`. Preserve the worktree unless the
user explicitly selects merge, PR or discard.

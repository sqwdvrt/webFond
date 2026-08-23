# Unified Content Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Завершить этап 3 одной защищенной админкой для проектов, новостей, документов и реквизитов, публикующей только проверенный контент.

**Architecture:** Чистые валидаторы нормализуют формы и versioned JSON, Prisma-репозиторий изолирует CRUD и публичные выборки, а auth-first server actions управляют optimistic locking и revalidation. Все admin-маршруты используют существующий protected layout и общий shell; публичные страницы читают только `PUBLISHED` и безопасно отделяют пустое состояние от сбоя БД.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components и Server Actions, TypeScript, Prisma 6/PostgreSQL, Vitest, Testing Library, axe-core, lucide-react.

---

## File Structure

- `prisma/schema.prisma`: статус документов и индексы публичных выборок.
- `prisma/migrations/20260823020000_content_publication/migration.sql`: безопасный backfill и индексы.
- `src/features/content-admin/types.ts`: типы форм, статусов, requisites JSON и результатов действий.
- `src/features/content-admin/validation.ts`: строгие FormData/JSON/URL-валидаторы.
- `src/features/content-admin/repository.ts`: списки, CRUD, optimistic locking и публичные чтения.
- `src/features/content-admin/mutations.ts`: auth-first orchestration мутаций без Next runtime.
- `src/app/admin/(protected)/content-actions.ts`: server action wrappers, revalidation и redirects.
- `src/app/admin/(protected)/admin-shell.tsx`: единый header/nav для всей админки.
- `src/app/admin/(protected)/content-ui.tsx`: общие status/list/form/delete элементы.
- `src/app/admin/(protected)/projects/**`: admin list/create/edit проектов.
- `src/app/admin/(protected)/news/**`: admin list/create/edit новостей.
- `src/app/admin/(protected)/documents/**`: admin list/create/edit документов.
- `src/app/admin/(protected)/requisites/**`: singleton requisites form/recovery.
- `src/components/content/published-content.tsx`: публичные карточки, документные ссылки и plain-text body.
- `src/app/projects/**`, `src/app/news/**`, `src/app/reports/page.tsx`, `src/app/requisites/page.tsx`: публичные данные.
- `src/app/sitemap.ts`: условные collection/detail URL.
- `src/app/admin/admin.module.css`, `src/app/globals.css`: responsive admin/public styles.
- Colocated `*.test.ts` and `*.test.tsx`: schema, validation, repository, actions, UI and public behavior.

### Task 1: Add Publication Schema and Safe Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260823020000_content_publication/migration.sql`
- Modify: `src/db/schema.test.ts`
- Create: `src/db/content-migration.test.ts`

- [ ] **Step 1: Write failing schema and migration tests**

Assert:

```ts
expect(documentModel).toContain("status      PublicationStatus @default(DRAFT)");
expect(projectModel).toContain("@@index([status, publishedAt, id])");
expect(newsModel).toContain("@@index([status, publishedAt, id])");
expect(documentModel).toContain("@@index([status, publishedAt, id])");
```

The SQL test must require this order: nullable `Document.status`, backfill by
`publishedAt`, `NOT NULL` plus default, project/news `publishedAt = updatedAt`
for existing published rows, then three indexes. Add a PostgreSQL integration
test guarded by `DATABASE_URL` that inserts legacy rows in a transaction,
executes the migration SQL against temporary tables/schema, and verifies status
and timestamp preservation.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/db/schema.test.ts src/db/content-migration.test.ts`

Expected: FAIL because status/index/migration are absent.

- [ ] **Step 3: Implement schema and migration**

Use quoted PostgreSQL identifiers and idempotence only through Prisma's migration
history; do not edit the initial migration. Preserve all existing rows.

- [ ] **Step 4: Verify schema, migration and client**

Run:

```bash
npm test -- src/db/schema.test.ts src/db/content-migration.test.ts
npm run db:validate
npm run db:generate
npx prisma migrate deploy
npx prisma migrate status
```

Expected: tests pass, schema valid, migration applied, database up to date.

- [ ] **Step 5: Commit**

```bash
git add prisma src/db
git commit -m "feat: add content publication schema"
```

### Task 2: Validate Content Forms and Requisites JSON

**Files:**
- Create: `src/features/content-admin/types.ts`
- Create: `src/features/content-admin/validation.ts`
- Create: `src/features/content-admin/validation.test.ts`

- [ ] **Step 1: Write failing editorial/document validator tests**

Cover trimming, optional blank-to-null, internal paragraph whitespace, title and
slug boundaries, repeated form values, invalid status, published summary/content
requirements, URL max length, `//host`, backslash, controls, credentials, HTTP,
valid HTTPS and valid single-slash local paths. Expose:

```ts
parseEditorialForm(form: FormData): ValidationResult<EditorialInput>
parseDocumentForm(form: FormData): ValidationResult<DocumentInput>
publicationTimestamp(status, existingPublishedAt, now): Date | null
```

`publicationTimestamp` returns existing first-published time, sets `now` only on
first publication, and never clears an existing value.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/features/content-admin/validation.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement editorial/document validation**

Use structured `FormData.getAll`, regular expressions only for bounded field
formats, and standard `URL` for remote links. Return field-keyed Russian errors;
never echo an unknown field.

- [ ] **Step 4: Write failing requisites tests**

Cover exact digit lengths, email, trim-before-validation, incomplete draft,
complete publication, unknown/malformed JSON, safe default from `siteConfig`, and
valid version 1 round trip. Expose:

```ts
parseRequisitesForm(form: FormData): ValidationResult<RequisitesSetting>
parseRequisitesSetting(value: Prisma.JsonValue): RequisitesParseResult
defaultRequisitesDraft(): RequisitesSetting
```

- [ ] **Step 5: Implement requisites validation and verify GREEN**

Run: `npm test -- src/features/content-admin/validation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/content-admin
git commit -m "feat: validate managed content"
```

### Task 3: Build Content Repository and Public Queries

**Files:**
- Create: `src/features/content-admin/repository.ts`
- Create: `src/features/content-admin/repository.test.ts`

- [ ] **Step 1: Write failing list/public-read tests**

Use an injected Prisma-shaped dependency. Assert admin lists sort by `updatedAt
DESC, id DESC`; public lists use `where: { status: "PUBLISHED" }`, select only
required fields, and sort by `publishedAt DESC, id DESC`. Published detail lookup
must use slug plus `PUBLISHED`; a missing row returns `null`, while a dependency
error rejects.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/features/content-admin/repository.test.ts`

Expected: FAIL because repository is missing.

- [ ] **Step 3: Implement typed reads**

Expose explicit functions rather than a generic model-name dispatcher:

```ts
listAdminProjects(); getAdminProject(id); listPublishedProjects(); getPublishedProject(slug)
listAdminNews(); getAdminNews(id); listPublishedNews(); getPublishedNewsPost(slug)
listAdminDocuments(); getAdminDocument(id); listPublishedDocuments()
getAdminRequisites(); getPublishedRequisites()
```

Runtime-validate requisites JSON. Public invalid JSON returns the safe fallback
state; admin invalid JSON returns a discriminated recoverable error.

- [ ] **Step 4: Write failing mutation/locking tests**

Cover create, unique-slug conflict mapping, updateMany by `id + updatedAt`, zero-
row conflict, first-publication timestamp, hard-delete only `DRAFT` with null
`publishedAt`, no requisites delete, initial requisites create, requisites
updateMany by `key + updatedAt`, and malformed-setting replacement.

- [ ] **Step 5: Implement mutations and verify repository**

Expose `create/update/delete` functions per entity plus
`saveRequisites` and `replaceInvalidRequisites`. Return discriminated
`ok | conflict | duplicate | forbidden | missing`; do not leak Prisma errors.

Run: `npm test -- src/features/content-admin/repository.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/content-admin/repository.ts src/features/content-admin/repository.test.ts
git commit -m "feat: persist managed content"
```

### Task 4: Add Auth-First Mutations and Cache Invalidation

**Files:**
- Create: `src/features/content-admin/mutations.ts`
- Create: `src/features/content-admin/mutations.test.ts`
- Create: `src/app/admin/(protected)/content-actions.ts`
- Create: `src/app/admin/(protected)/content-actions.test.ts`

- [ ] **Step 1: Write failing orchestration tests**

Inject session, parser, repository, clock and navigation dependencies. For every
create/update/delete/requisites operation assert session runs before parsing and
database access. Assert validation/conflict/duplicate/forbidden return neutral
form state without redirect. Assert success returns a typed effect description:

```ts
type MutationEffect = {
  revalidate: string[];
  redirectTo: string;
};
```

Project/news updates include old/new slugs; archive/delete includes old slug;
document publication includes `/reports` and `/sitemap.xml`; requisites includes
`/requisites`. Deduplicate paths.

- [ ] **Step 2: Verify RED and implement mutation cores**

Run: `npm test -- src/features/content-admin/mutations.test.ts`

Expected RED, then PASS after implementation.

- [ ] **Step 3: Write failing Next wrapper tests**

Assert wrappers call every `revalidatePath`, then redirect. Assert no revalidate
or redirect on form error. Source-integrity test requires top-level `"use server"`
and excludes form payload logging.

- [ ] **Step 4: Implement server action wrappers**

Export separate async actions for project/news/document create/update/delete,
save requisites and replace invalid requisites. Keep pure orchestration in
`mutations.ts`; wrappers only bind production dependencies and Next effects.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/features/content-admin/mutations.test.ts 'src/app/admin/(protected)/content-actions.test.ts'
git add src/features/content-admin/mutations* 'src/app/admin/(protected)/content-actions*'
git commit -m "feat: mutate content securely"
```

### Task 5: Build the Single Admin Shell and Shared UI

**Files:**
- Create: `src/app/admin/(protected)/admin-shell.tsx`
- Create: `src/app/admin/(protected)/admin-shell.test.tsx`
- Create: `src/app/admin/(protected)/content-ui.tsx`
- Create: `src/app/admin/(protected)/content-ui.test.tsx`
- Modify: `src/app/admin/(protected)/layout.tsx`
- Modify: `src/app/admin/(protected)/page.tsx`
- Modify: `src/app/admin/admin.module.css`

- [ ] **Step 1: Write failing shell/UI tests**

Assert one shell exposes Overview, Projects, News, Documents, Requisites and
Donations links plus logout; protected layout checks the session before render.
Test status labels, compact list, field errors, pending button state, success
status and delete confirmation only when `status === DRAFT && !publishedAt`.
Run Axe on desktop markup for populated and empty list/form states.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- 'src/app/admin/(protected)/admin-shell.test.tsx' 'src/app/admin/(protected)/content-ui.test.tsx'
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement shell and shared operational controls**

Use lucide icons, a persistent restrained nav, 6px controls, no nested cards,
horizontal nav/table scroll at narrow widths, and tooltips for unfamiliar icon-
only controls. `content-ui.tsx` may share presentational pieces but must not hide
entity-specific field definitions behind a generic schema renderer.

- [ ] **Step 4: Update dashboard and responsive CSS**

The overview links all sections and reuses the shell; do not duplicate the
account/logout header inside the page. Confirm fixed controls cannot shift.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- 'src/app/admin/(protected)/admin-shell.test.tsx' 'src/app/admin/(protected)/content-ui.test.tsx' src/app/admin/admin-accessibility.test.tsx
git add 'src/app/admin/(protected)' src/app/admin/admin.module.css
git commit -m "feat: unify admin workspace"
```

### Task 6: Add Project and News Admin Workflows

**Files:**
- Create: `src/app/admin/(protected)/projects/page.tsx`
- Create: `src/app/admin/(protected)/projects/new/page.tsx`
- Create: `src/app/admin/(protected)/projects/[id]/page.tsx`
- Create: `src/app/admin/(protected)/projects/project-form.tsx`
- Create: `src/app/admin/(protected)/projects/projects-admin.test.tsx`
- Create: `src/app/admin/(protected)/news/page.tsx`
- Create: `src/app/admin/(protected)/news/new/page.tsx`
- Create: `src/app/admin/(protected)/news/[id]/page.tsx`
- Create: `src/app/admin/(protected)/news/news-form.tsx`
- Create: `src/app/admin/(protected)/news/news-admin.test.tsx`

- [ ] **Step 1: Write failing project admin tests**

Cover list/empty state, create link, edit URL, all fields, initial values,
`updatedAt` hidden token, Russian status labels, validation errors, success
message, eligible/ineligible delete, and `notFound()` for missing ID.

- [ ] **Step 2: Implement projects routes/forms and verify**

Use repository reads in server pages and action wrappers in client forms. Do not
query Prisma directly from JSX. Preserve submitted values after errors.

Run: `npm test -- 'src/app/admin/(protected)/projects/projects-admin.test.tsx'`

- [ ] **Step 3: Write failing news admin tests**

Mirror behavior, but assert `/admin/news` paths/actions and news-specific labels.

- [ ] **Step 4: Implement news routes/forms and verify**

Run: `npm test -- 'src/app/admin/(protected)/news/news-admin.test.tsx'`

- [ ] **Step 5: Commit**

```bash
git add 'src/app/admin/(protected)/projects' 'src/app/admin/(protected)/news'
git commit -m "feat: manage projects and news"
```

### Task 7: Add Documents and Requisites Admin Workflows

**Files:**
- Create: `src/app/admin/(protected)/documents/page.tsx`
- Create: `src/app/admin/(protected)/documents/new/page.tsx`
- Create: `src/app/admin/(protected)/documents/[id]/page.tsx`
- Create: `src/app/admin/(protected)/documents/document-form.tsx`
- Create: `src/app/admin/(protected)/documents/documents-admin.test.tsx`
- Create: `src/app/admin/(protected)/requisites/page.tsx`
- Create: `src/app/admin/(protected)/requisites/requisites-form.tsx`
- Create: `src/app/admin/(protected)/requisites/requisites-admin.test.tsx`

- [ ] **Step 1: Write failing documents tests**

Cover list/create/edit, title/category/document URL/status, optimistic token,
eligible delete, no PDF-format promise, neutral error and accessibility.

- [ ] **Step 2: Implement documents and verify**

Run: `npm test -- 'src/app/admin/(protected)/documents/documents-admin.test.tsx'`

- [ ] **Step 3: Write failing requisites tests**

Cover fallback defaults, all legal/bank fields, status, initial create without
token, update with token, malformed JSON error without rendering its values,
confirmed safe-draft replacement and absence of delete.

- [ ] **Step 4: Implement requisites and verify**

Run: `npm test -- 'src/app/admin/(protected)/requisites/requisites-admin.test.tsx'`

- [ ] **Step 5: Commit**

```bash
git add 'src/app/admin/(protected)/documents' 'src/app/admin/(protected)/requisites'
git commit -m "feat: manage documents and requisites"
```

### Task 8: Publish Projects and News Safely

**Files:**
- Create: `src/components/content/published-content.tsx`
- Create: `src/components/content/published-content.test.tsx`
- Modify: `src/app/projects/page.tsx`
- Modify: `src/app/projects/projects-pages.test.tsx`
- Create: `src/app/projects/[slug]/page.tsx`
- Create: `src/app/projects/[slug]/project-detail.test.tsx`
- Modify: `src/app/news/page.tsx`
- Modify: `src/app/placeholder-pages.test.tsx`
- Create: `src/app/news/[slug]/page.tsx`
- Create: `src/app/news/[slug]/news-detail.test.tsx`
- Create: `src/app/projects/error.tsx`
- Create: `src/app/news/error.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing shared public component tests**

Cover local/external image rendering, safe alt, paragraphs without HTML
interpretation, cards and dates. Assert no `dangerouslySetInnerHTML` source.

- [ ] **Step 2: Implement shared public components**

Use stable image dimensions/aspect ratio and responsive text. External images
must not be fetched server-side.

- [ ] **Step 3: Write failing project page tests**

Inject public-read dependency. Assert charter list always remains; published
cards append below; empty adds no block; database failure shows temporary error
but keeps charter. Detail renders only published, calls `notFound` only on null,
propagates database errors, and generates canonical metadata.

- [ ] **Step 4: Implement project list/detail/error**

Run project tests and retain all existing statutory copy assertions.

- [ ] **Step 5: Write failing news page tests**

Cover published list, honest empty state, temporary error, conditional robots,
published detail metadata and inaccessible draft/archive through repository
filtering.

- [ ] **Step 6: Implement news list/detail/error and verify**

Run:

```bash
npm test -- src/components/content/published-content.test.tsx src/app/projects/projects-pages.test.tsx 'src/app/projects/[slug]/project-detail.test.tsx' src/app/placeholder-pages.test.tsx 'src/app/news/[slug]/news-detail.test.tsx'
```

- [ ] **Step 7: Commit**

```bash
git add src/components/content src/app/projects src/app/news src/app/globals.css
git commit -m "feat: publish projects and news"
```

### Task 9: Publish Documents, Requisites and Dynamic SEO

**Files:**
- Modify: `src/app/reports/page.tsx`
- Create: `src/app/reports/reports-page.test.tsx`
- Create: `src/app/reports/error.tsx`
- Modify: `src/app/requisites/page.tsx`
- Modify: `src/app/information-pages.test.tsx`
- Create: `src/app/requisites/error.tsx`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/seo-routes.test.ts`

- [ ] **Step 1: Write failing reports/requisites tests**

Reports group published links by category, use exact safe href, keep empty state,
show temporary error distinctly and set conditional robots. Requisites use only
validated `PUBLISHED`; draft/archived/malformed/error all preserve confirmed
`siteConfig` legal rows and hide bank values.

- [ ] **Step 2: Implement reports and requisites**

Keep external document links explicit and do not claim file type. Email remains
a `mailto:` link where rendered.

- [ ] **Step 3: Write failing async sitemap tests**

Inject public route dependency. Assert base static routes, conditional `/news`
and `/reports`, published project/news details, absolute URLs, stable ordering,
and exclusion of admin/draft/archive/document URLs. Database failure returns only
safe static routes rather than failing sitemap generation.

- [ ] **Step 4: Implement async sitemap and metadata behavior**

Update SEO tests for async `sitemap()` and collection `generateMetadata`.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/app/reports/reports-page.test.tsx src/app/information-pages.test.tsx src/app/seo-routes.test.ts
git add src/app/reports src/app/requisites src/app/sitemap.ts src/app/seo-routes.test.ts
git commit -m "feat: publish documents and requisites"
```

### Task 10: Documentation, Review and End-to-End Verification

**Files:**
- Modify: `PROJECT_PLAN.md`
- Modify: `README.md`
- Modify: `WORK_REPORT.md`
- Modify tests/code only for confirmed review findings.

- [ ] **Step 1: Update documentation**

Mark authorization and content-management bullets complete. Document one admin,
publication statuses, URL-only media/documents, migration command and the rule
that only published content is public. Record migration/browser verification.

- [ ] **Step 2: Run focused and complete automated checks**

```bash
npm test -- src/features/content-admin
npm test
npm run lint
npm run typecheck
npm run db:validate
npm run db:generate
npx prisma migrate deploy
npx prisma migrate status
npm run build
git diff --check
```

Expected: all exit 0 and database schema is up to date.

- [ ] **Step 3: Request code review**

Compare the implementation base commit to HEAD. Review auth ordering, migration
backfill, validation, stale-write protection, delete policy, cache invalidation,
public status filtering, malformed JSON fallback, metadata/sitemap, responsive UI
and test gaps. Fix every Critical/Important finding with RED/GREEN tests and
request re-review until approved.

- [ ] **Step 4: Run browser CRUD QA with dedicated fixtures**

Using the existing admin session and local PostgreSQL:

1. Create a draft project and verify it is absent publicly.
2. Publish it and verify card/detail plus sitemap.
3. Rename slug and verify old URL is 404 and new URL renders.
4. Archive it and verify both list/detail disappearance.
5. Create then delete a never-published draft.
6. Repeat publish/archive for one news post and one document link.
7. Save incomplete requisites draft, then publish complete fixture values and
   verify public rendering; return it to archived before cleanup.
8. Verify desktop 1440 and mobile 390 layouts, no horizontal page overflow,
   accessible labels, no unexpected browser errors and privacy headers.

Delete dedicated never-published fixtures and archive any fixture that was
published; never alter unrelated records.

- [ ] **Step 5: Commit docs/review fixes and finish branch**

```bash
git add PROJECT_PLAN.md README.md WORK_REPORT.md <review-fix-paths>
git commit -m "docs: complete stage 3 content admin"
git status --short
```

Only user-owned untracked `output/`, `scripts/` and `tmp/` may remain. Preserve
the branch/worktree unless the user selects another integration option.

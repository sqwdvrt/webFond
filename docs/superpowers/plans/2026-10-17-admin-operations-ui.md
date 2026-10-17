# Admin Operations UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete L1–L13 with a secure server-rendered contact queue, richer operations dashboard, accessible states, responsive behavior, and rollback documentation.

**Architecture:** Keep the existing Next.js App Router server-first boundary: URL query parameters drive list reads, server components render data, and server actions own mutations. Add small presentation helpers/components, extend the single repeatable-read dashboard snapshot, and use CSS to transform one semantic contact table into narrow-screen cards without a client data API.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, CSS Modules, Vitest, Testing Library, user-event, axe-core.

**Design:** `docs/superpowers/specs/2026-10-17-admin-operations-ui-design.md`

---

## File map

- Create `src/features/admin-messages/presentation.ts`: canonical contact labels,
  safe email/reply URL builders, excerpt normalization, pagination item builder.
- Create `src/features/admin-messages/presentation.test.ts`: pure behavior tests for
  labels, encoding, excerpts, and bounded pagination.
- Create `src/app/admin/(protected)/messages/contact-status-badge.tsx`: reusable
  visual status component.
- Create `src/app/admin/(protected)/messages/contact-status-badge.test.tsx`:
  component and axe assertions.
- Modify `src/app/admin/(protected)/messages/messages-view.tsx`: GET filters,
  semantic table, numeric pagination, shared presentation helpers.
- Modify `src/app/admin/(protected)/messages/message-form.tsx`: canonical labels.
- Modify `src/app/admin/(protected)/messages/[id]/page.tsx`: status display and
  encoded reply link with fixed subject.
- Modify the existing message page/form tests for L2–L6 behavior and keyboard
  interaction.
- Modify `src/features/admin-dashboard/alerts.ts` and its test: exact hrefs and
  explicit priority.
- Modify `src/features/admin-dashboard/read-model.ts` and its test: active
  contacts, content counts, ten minimized audit rows.
- Modify `src/app/admin/(protected)/page.tsx` and dashboard tests: metric cards,
  safe entity labels, linked alerts.
- Create `src/app/admin/(protected)/admin-loading.tsx` and test: shared neutral
  loading UI.
- Create `src/app/admin/(protected)/loading.tsx` and
  `src/app/admin/(protected)/messages/loading.tsx`: route loading boundaries.
- Modify `src/app/admin/admin.module.css`, `src/app/admin/admin-styles.test.ts`,
  and accessibility tests: responsive table cards, focus, wrapping, forced
  colors, and non-overflow contracts.
- Retain `src/app/admin/(protected)/admin-nav.tsx` and strengthen
  `src/app/admin/(protected)/admin-nav.test.ts`: L10 zero/non-zero badge contract.
- Modify `src/features/admin-operations.integration.test.ts`: DB-gated aggregate
  assertions for the expanded read model.
- Create `src/app/admin/admin-operations-docs.test.ts`: executable L13
  documentation contract with one assertion per rollback/operations clause.
- Modify `README.md` and `WORK_REPORT.md`: thresholds, checks, compatibility
  rollback, and actual smoke-test status.

---

### Task 1: Canonical contact presentation primitives (L1, L6)

**Files:**
- Create: `src/features/admin-messages/presentation.ts`
- Create: `src/features/admin-messages/presentation.test.ts`
- Create: `src/app/admin/(protected)/messages/contact-status-badge.tsx`
- Create: `src/app/admin/(protected)/messages/contact-status-badge.test.tsx`
- Modify: `src/app/admin/admin.module.css`

- [ ] **Step 1: Write failing pure-helper tests**

Cover the exact canonical map and hostile address encoding:

```ts
expect(CONTACT_STATUS_LABELS).toEqual({
  NEW: "Новое",
  IN_PROGRESS: "В работе",
  CLOSED: "Закрыто",
  SPAM: "Спам",
});
expect(contactReplyHref("victim?subject=x@example.org")).toBe(
  "mailto:victim%3Fsubject%3Dx@example.org?subject=" +
    encodeURIComponent("Ответ фонда «Быть Добру»"),
);
expect(contactExcerpt("  Первая\n\n строка  ")).toBe("Первая строка");
expect(contactExcerpt("😀".repeat(180))).toBe("😀".repeat(180));
expect(contactExcerpt("😀".repeat(181))).toBe(`${"😀".repeat(180)}…`);
```

- [ ] **Step 2: Run the helper test and verify RED**

Run: `npm test -- src/features/admin-messages/presentation.test.ts`

Expected: FAIL because the module/exports do not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

Export:

```ts
export const CONTACT_STATUS_LABELS: Record<ContactStatusValue, string> = { ... };
export const CONTACT_REPLY_SUBJECT = "Ответ фонда «Быть Добру»";
export function contactEmailHref(email: string): string;
export function contactReplyHref(email: string): string;
export function contactExcerpt(message: string, limit = 180): string;
```

Encode the address as one component, restore only `%40` to `@`, encode the
fixed subject separately, normalize whitespace before Unicode code-point
truncation, and never include message/note/name in the URL.

- [ ] **Step 4: Verify helper GREEN**

Run: `npm test -- src/features/admin-messages/presentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing badge component test**

Render all four statuses. Assert visible Russian text, a status-specific class,
no icon-only label, and no serious/critical axe violation.

- [ ] **Step 6: Run the badge test and verify RED**

Run: `npm test -- 'src/app/admin/(protected)/messages/contact-status-badge.test.tsx'`

Expected: FAIL because the component does not exist.

- [ ] **Step 7: Implement the badge and accessible CSS**

The component renders only trusted enum data:

```tsx
<span className={`${styles.contactStatus} ${styles[`contactStatus${status}`]}`}>
  {CONTACT_STATUS_LABELS[status]}
</span>
```

Add foreground, background, and border for each status plus
`@media (forced-colors: active)` using `forced-color-adjust: auto` and a visible
border. Do not rely on color to name state.

- [ ] **Step 8: Verify badge GREEN and commit**

Run: `npm test -- src/features/admin-messages/presentation.test.ts 'src/app/admin/(protected)/messages/contact-status-badge.test.tsx'`

```bash
git add src/features/admin-messages/presentation.ts src/features/admin-messages/presentation.test.ts 'src/app/admin/(protected)/messages/contact-status-badge.tsx' 'src/app/admin/(protected)/messages/contact-status-badge.test.tsx' src/app/admin/admin.module.css
git commit -m "feat: centralize contact presentation"
```

### Task 2: Semantic queue table and numbered pagination (L2–L4)

**Files:**
- Modify: `src/features/admin-messages/presentation.ts`
- Modify: `src/features/admin-messages/presentation.test.ts`
- Modify: `src/app/admin/(protected)/messages/messages-view.tsx`
- Modify: `src/app/admin/(protected)/messages/messages-page.test.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `src/app/admin/admin-styles.test.ts`

- [ ] **Step 1: Write failing pagination tests**

Specify a discriminated result such as:

```ts
expect(paginationItems(1, 1)).toEqual([{ kind: "page", page: 1 }]);
expect(paginationItems(5, 10)).toEqual([
  { kind: "page", page: 1 },
  { kind: "ellipsis", key: "start" },
  { kind: "page", page: 3 },
  { kind: "page", page: 4 },
  { kind: "page", page: 5 },
  { kind: "page", page: 6 },
  { kind: "page", page: 7 },
  { kind: "ellipsis", key: "end" },
  { kind: "page", page: 10 },
]);
```

Also reject/clamp impossible helper inputs internally so it cannot generate a
link outside `1..totalPages`.

- [ ] **Step 2: Run the helper test and verify RED**

Run: `npm test -- src/features/admin-messages/presentation.test.ts`

Expected: FAIL because `paginationItems` is missing.

- [ ] **Step 3: Implement the bounded pagination helper**

Return all pages for at most seven total pages; otherwise return first/last,
up to five pages centered around current, and stable inert ellipses. Keep URL
building in `messages-view.tsx` through `buildContactQuery`.

- [ ] **Step 4: Write failing list UI tests**

Update `messages-page.test.tsx` to require:

- a table named «Обращения» with the six specified headers;
- row cells containing name, encoded email, Moscow time, badge, normalized
  excerpt, and detail link;
- GET controls named `q/status/from/to`, buttons «Применить» and «Сбросить»;
- numbered links with `aria-current="page"`, previous/next, and all filters
  retained in every href;
- no private note in the list and no pagination in the empty state;
- the empty state contains a visible «Сбросить фильтры» link with exact
  `href="/admin/messages"`;
- axe has no serious/critical violations.

- [ ] **Step 5: Run the UI test and verify RED**

Run: `npm test -- 'src/app/admin/(protected)/messages/messages-page.test.tsx'`

Expected: FAIL because the current page renders cards, has no page numbers, and
labels reset as «Очистить».

- [ ] **Step 6: Implement the semantic table and pagination**

Use `<caption className={styles.visuallyHidden}>Обращения</caption>`, `<thead>`,
`<tbody>`, `<th scope="col">`, and `data-label` on each mobile cell. Use the
badge and pure helpers from Task 1. Numeric current page is a non-link `<span
aria-current="page">`; ellipses are hidden from assistive technology. Preserve
the existing authenticated invalid-filter behavior and `prefetch={false}` on
detail links.

- [ ] **Step 7: Write failing responsive CSS contracts**

Require at `max-width: 720px` that table sections/rows/cells become block/grid,
the header is visually hidden without `display:none`, cells have `min-width:0`
and `overflow-wrap:anywhere`, and the table has no fixed `min-width`. Require
visible `:focus-visible` rules for filter controls and pagination links.

- [ ] **Step 8: Run CSS tests and verify RED**

Run: `npm test -- src/app/admin/admin-styles.test.ts`

Expected: FAIL on the new table contracts.

- [ ] **Step 9: Implement responsive CSS and verify GREEN**

Run:

```bash
npm test -- src/features/admin-messages/presentation.test.ts \
  'src/app/admin/(protected)/messages/messages-page.test.tsx' \
  src/app/admin/admin-styles.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/features/admin-messages/presentation.ts src/features/admin-messages/presentation.test.ts 'src/app/admin/(protected)/messages/messages-view.tsx' 'src/app/admin/(protected)/messages/messages-page.test.tsx' src/app/admin/admin.module.css src/app/admin/admin-styles.test.ts
git commit -m "feat: add responsive contact table pagination"
```

### Task 3: Complete contact detail and edit presentation (L1, L5–L6)

**Files:**
- Modify: `src/app/admin/(protected)/messages/[id]/page.tsx`
- Modify: `src/app/admin/(protected)/messages/message-form.tsx`
- Modify: `src/app/admin/(protected)/messages/message-form.test.tsx`
- Modify: `src/app/admin/(protected)/messages/messages-page.test.tsx`
- Modify: `src/app/admin/(protected)/page.tsx`
- Modify: `src/app/admin/(protected)/admin-dashboard.test.tsx`
- Modify: `src/app/admin/admin.module.css`

- [ ] **Step 1: Write failing detail/form tests**

Assert the detail page renders name, displayed email, full message, Moscow
created/updated times, status badge, note editor, and a link named «Ответить по
email» whose href equals `contactReplyHref(contact.email)`. Assert no form/action
exists that sends email. Run axe against the complete rendered detail page and
require no serious/critical violation.

Add a source-contract test that reads `message-form.tsx`, `messages-view.tsx`,
and dashboard `page.tsx`, requires an import of `CONTACT_STATUS_LABELS`, and
rejects every local `NEW: "Новое"`, `IN_PROGRESS: "В работе"`, `CLOSED:
"Закрыто"`, and `SPAM: "Спам"` literal/map entry in all three consumers. Require
the dashboard contact branch to index `CONTACT_STATUS_LABELS`; publication
status labels remain in a separate publication-only map. This source assertion
is intentional: rendered text alone cannot distinguish the canonical map from
an identical duplicate. Keep the behavior assertion that form options equal
`Object.values(CONTACT_STATUS_LABELS)`.

- [ ] **Step 2: Run detail/form tests and verify RED**

Run: `npm test -- 'src/app/admin/(protected)/messages/messages-page.test.tsx' 'src/app/admin/(protected)/messages/message-form.test.tsx'`

Expected: FAIL because detail lacks badge/reply subject and the source-contract
detects local duplicate maps.

- [ ] **Step 3: Implement minimal detail/form changes**

Import the canonical map into the form and dashboard activity formatter. Render
the status badge in detail metadata and the separate reply link. Keep the
displayed email link address-only; the explicit reply action uses the fixed
subject. Preserve the hidden canonical `updatedAt` token and current validation
state behavior.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- 'src/app/admin/(protected)/messages/messages-page.test.tsx' 'src/app/admin/(protected)/messages/message-form.test.tsx' 'src/app/admin/(protected)/admin-dashboard.test.tsx'`

```bash
git add 'src/app/admin/(protected)/messages/[id]/page.tsx' 'src/app/admin/(protected)/messages/message-form.tsx' 'src/app/admin/(protected)/messages/message-form.test.tsx' 'src/app/admin/(protected)/messages/messages-page.test.tsx' 'src/app/admin/(protected)/page.tsx' 'src/app/admin/(protected)/admin-dashboard.test.tsx' src/app/admin/admin.module.css
git commit -m "feat: complete contact detail presentation"
```

### Task 4: Expand the dashboard read model safely (L7–L9)

**Files:**
- Modify: `src/features/admin-dashboard/alerts.ts`
- Modify: `src/features/admin-dashboard/alerts.test.ts`
- Modify: `src/features/admin-dashboard/read-model.ts`
- Modify: `src/features/admin-dashboard/read-model.test.ts`
- Modify: `src/features/admin-operations.integration.test.ts`

- [ ] **Step 1: Write failing alert tests**

Require exact output order and hrefs:

```ts
[
  { code: "ADMIN_CONFIGURATION", href: "/api/ready", ... },
  { code: "STALE_PENDING_DONATIONS", href: "/admin/donations?status=PENDING", ... },
  { code: "STALE_NEW_CONTACTS", href: "/admin/messages?status=NEW", ... },
]
```

Keep the exact 48-hour/one-hour cutoff tests. Aggregate counts and fixed
thresholds are allowed in messages; assert that row-level data, PII, readiness
issue values, and configuration values are absent from messages and URLs.

- [ ] **Step 2: Run alert tests and verify RED**

Run: `npm test -- src/features/admin-dashboard/alerts.test.ts`

Expected: FAIL because alerts have no href and use the old order.

- [ ] **Step 3: Implement the alert contract and verify GREEN**

Add `href` to `OperationalAlert`; construct alerts in readiness, donation,
contact order with constant hrefs. Do not derive URLs from database rows or
readiness issue values.

- [ ] **Step 4: Write failing unit and DB-gated read-model tests**

Extend the database fake with `project`, `newsPost`, and `document` count
delegates. Require:

```ts
tx.contactRequest.count({ where: { status: "IN_PROGRESS" } });
tx.project.count({ where: { status: "PUBLISHED" } });
tx.project.count({ where: { status: "DRAFT" } });
tx.newsPost.count({ where: { status: "DRAFT" } });
tx.document.count({ where: { status: "DRAFT" } });
```

Require `messages: { newCount, activeCount }`, `content: {
publishedProjectCount, draftCount }`, `take: 10`, and an audit `select` without
`entityId`. Assert draft count is the sum of the three delegates.

Before production changes, also extend the DB-gated fixture in
`admin-operations.integration.test.ts` with published/draft content and an
IN_PROGRESS contact. Require exact real read-model counts, ten-or-fewer activity
rows, and no `entityId` property.

- [ ] **Step 5: Run both tests and verify RED/SKIP honestly**

Run: `npm test -- src/features/admin-dashboard/read-model.test.ts src/features/admin-operations.integration.test.ts`

Expected: unit test FAIL on missing delegates/metrics, `take: 20`, and
`entityId`. With a safe `ADMIN_OPERATIONS_TEST_DATABASE_URL`, the integration
test also FAILS on missing metrics; without it, record the DB test as SKIPPED and
the unit RED as the observed pre-implementation proof.

- [ ] **Step 6: Implement one repeatable-read snapshot**

Add five new count queries to the existing transaction `Promise.all`: one
IN_PROGRESS contact count, one PUBLISHED project count, and one DRAFT count for
each of project/news/document. Name all five corresponding snapshot tuple/result
fields, sum the three draft values in the returned `content.draftCount`, keep
donation periods unchanged, remove `entityId` from `SafeAdminAuditEvent` and
Prisma selection, and return the expanded model. Do not add UI queries or API
routes.

- [ ] **Step 7: Verify dashboard domain GREEN and commit**

Run: `npm test -- src/features/admin-dashboard/alerts.test.ts src/features/admin-dashboard/read-model.test.ts src/features/admin-operations.integration.test.ts`

Expected without DB URL: unit tests PASS; DB-gated file SKIP.

```bash
git add src/features/admin-dashboard/alerts.ts src/features/admin-dashboard/alerts.test.ts src/features/admin-dashboard/read-model.ts src/features/admin-dashboard/read-model.test.ts src/features/admin-operations.integration.test.ts
git commit -m "feat: expand admin dashboard read model"
```

### Task 5: Render dashboard metrics, safe activity, and linked warnings (L7–L9)

**Files:**
- Modify: `src/app/admin/(protected)/page.tsx`
- Modify: `src/app/admin/(protected)/admin-dashboard.test.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `src/app/admin/admin-styles.test.ts`

- [ ] **Step 1: Write failing dashboard component tests**

Require cards for new and active contacts, today/month donations, published
projects, and total drafts. Require every activity item to show a safe entity
type label plus description and Moscow time. Assert no audit ID/entity ID/PII is
rendered. Add activity fixtures whose `previousStatus`/`nextStatus` contain
unknown private markers; require a generic allow-listed description and assert
the markers are absent. Require warning links with exact hrefs and order, then
run axe.

- [ ] **Step 2: Run the dashboard test and verify RED**

Run: `npm test -- 'src/app/admin/(protected)/admin-dashboard.test.tsx'`

Expected: FAIL because three metric groups (active contacts, published projects,
and total drafts), entity labels, and links are absent.

- [ ] **Step 3: Implement the dashboard rendering**

Keep `renderAdminDashboard` authentication-first and load exactly one model.
Render the six metric groups from that model. Add a fixed entity label map
(`PROJECT`, `NEWS_POST`, `DOCUMENT`, `CONTACT_REQUEST`) and no identifier output.
Use each alert's constant href; do not append details in the component.

- [ ] **Step 4: Add responsive metric/alert/activity CSS tests, verify RED**

Require grid collapse at 720px, `min-width:0`, safe wrapping, 44px linked warning
targets, and focus-visible outlines.

- [ ] **Step 5: Implement CSS and verify GREEN**

Run: `npm test -- 'src/app/admin/(protected)/admin-dashboard.test.tsx' src/app/admin/admin-styles.test.ts`

- [ ] **Step 6: Commit**

```bash
git add 'src/app/admin/(protected)/page.tsx' 'src/app/admin/(protected)/admin-dashboard.test.tsx' src/app/admin/admin.module.css src/app/admin/admin-styles.test.ts
git commit -m "feat: complete operations dashboard UI"
```

### Task 6: Loading, empty, invalid, and temporary error states (L11)

**Files:**
- Create: `src/app/admin/(protected)/admin-loading.tsx`
- Create: `src/app/admin/(protected)/admin-loading.test.tsx`
- Create: `src/app/admin/(protected)/loading.tsx`
- Create: `src/app/admin/(protected)/messages/loading.tsx`
- Modify: `src/app/admin/(protected)/admin-error.test.tsx`
- Modify: `src/app/admin/(protected)/messages/messages-page.test.tsx`
- Modify: `src/app/admin/admin.module.css`

- [ ] **Step 1: Write failing loading-state tests**

Require a neutral heading/text, `aria-busy="true"`, no fabricated numeric value,
no animation dependency, and no serious/critical axe finding. Source-contract
assert both route `loading.tsx` files render the shared component.

- [ ] **Step 2: Run the loading test and verify RED**

Run: `npm test -- 'src/app/admin/(protected)/admin-loading.test.tsx'`

Expected: FAIL because the files do not exist.

- [ ] **Step 3: Implement shared loading UI and route boundaries**

Render stable labelled blocks with text such as «Загрузка данных…»; do not copy
the last result or invent skeleton numbers. Respect reduced motion by having no
required animation.

- [ ] **Step 4: Strengthen existing state tests**

Add axe assertions for invalid filters and empty results. In
`admin-error.test.tsx`, assert thrown message, digest, query text, and private
values never render; the retry button remains keyboard-native and calls reset.
Run axe against `AdminError` and require no serious/critical violations.

- [ ] **Step 5: Verify state GREEN and commit**

Run: `npm test -- 'src/app/admin/(protected)/admin-loading.test.tsx' 'src/app/admin/(protected)/admin-error.test.tsx' 'src/app/admin/(protected)/messages/messages-page.test.tsx'`

```bash
git add 'src/app/admin/(protected)/admin-loading.tsx' 'src/app/admin/(protected)/admin-loading.test.tsx' 'src/app/admin/(protected)/loading.tsx' 'src/app/admin/(protected)/messages/loading.tsx' 'src/app/admin/(protected)/admin-error.test.tsx' 'src/app/admin/(protected)/messages/messages-page.test.tsx' src/app/admin/admin.module.css
git commit -m "feat: add admin loading and state coverage"
```

### Task 7: Responsive and accessibility acceptance (L12)

**Files:**
- Modify: `src/app/admin/admin-accessibility.test.tsx`
- Modify: `src/app/admin/admin-styles.test.ts`
- Modify: `src/app/admin/(protected)/admin-nav.test.ts`
- Modify: `src/app/admin/(protected)/messages/messages-page.test.tsx`
- Modify: `src/app/admin/(protected)/admin-dashboard.test.tsx`
- Modify: `src/app/admin/admin.module.css`

- [ ] **Step 1: Write failing keyboard and viewport-contract tests**

Use `userEvent.tab()` to assert filter order: status → from → to → search →
Apply → Reset. Assert current page is announced once and decorative icons are
hidden. Extend CSS tests for desktop table display, 720px card conversion,
wrapping, focus-visible, forced-colors, and absence of fixed table width that
would overflow a 390px page.

For L10, extend `admin-nav.test.ts`: count zero renders no badge and no count in
the link accessible name; a positive count renders visible digits but the
complete link is announced exactly once as, for example, «Письма, 3 новых
обращения». Confirm there is no client fetch/API path.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/app/admin/admin-accessibility.test.tsx src/app/admin/admin-styles.test.ts 'src/app/admin/(protected)/admin-nav.test.ts' 'src/app/admin/(protected)/messages/messages-page.test.tsx' 'src/app/admin/(protected)/admin-dashboard.test.tsx'`

Expected: FAIL on the newly asserted behavior/contracts.

- [ ] **Step 3: Make only required markup/CSS corrections**

Preserve native DOM order, add missing `aria-hidden`, focus rules, wrapping, or
minimum targets. Do not add positive `tabIndex`, JS viewport branching, or a
second mobile DOM tree.

- [ ] **Step 4: Verify focused acceptance GREEN**

Run the same command. Expected: PASS with no serious/critical axe findings.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/admin-accessibility.test.tsx src/app/admin/admin-styles.test.ts 'src/app/admin/(protected)/admin-nav.test.ts' 'src/app/admin/(protected)/messages/messages-page.test.tsx' 'src/app/admin/(protected)/admin-dashboard.test.tsx' src/app/admin/admin.module.css
git commit -m "test: verify responsive admin accessibility"
```

### Task 8: Operator documentation and rollback (L13)

**Files:**
- Create: `src/app/admin/admin-operations-docs.test.ts`
- Modify: `README.md`
- Modify: `WORK_REPORT.md`

- [ ] **Step 1: Write and run a failing documentation contract test**

Read both documents and use separate expectations (not one alternation) for:

1. `pg_trgm` ownership and maintenance window;
2. safe `_test` integration command;
3. exact 48-hour and one-hour thresholds;
4. forward-fix preference;
5. rollback-compatible build generated with `SPAM`;
6. original artifact prohibition after SPAM use;
7. backup + count + transactional `SPAM` to `IN_PROGRESS` lossy remediation;
8. later cleanup backup + no-use proof + separately reviewed maintenance
   migration;
9. no destructive automatic down migration.

Run: `npm test -- src/app/admin/admin-operations-docs.test.ts`

Expected: FAIL on the currently undocumented compatibility/cleanup clauses.

- [ ] **Step 2: Add the exact operating contract**

Document:

- migration prerequisites, maintenance window, backup, and `pg_trgm` ownership;
- `ADMIN_OPERATIONS_TEST_DATABASE_URL` commands and safe `_test` guard;
- alert cutoffs (`createdAt < now - 48h`, `createdAt < now - 1h`);
- forward-fix preference;
- a prepared rollback-compatible build whose generated Prisma enum includes
  `SPAM`;
- prohibition on restoring an original pre-migration artifact after SPAM may
  have been used;
- emergency backup/count/transactional `SPAM → IN_PROGRESS` remediation before
  the original artifact, explicitly marked lossy and approval-required;
- why no destructive automatic down migration is provided.
- a later cleanup procedure that starts with a fresh backup, proves no rows use
  `SPAM` or depend on `internalNote`/audit data, and runs only through a separate
  reviewed maintenance migration rather than ad-hoc production SQL.

- [ ] **Step 3: Verify documentation facts**

Run:

```bash
npm test -- src/app/admin/admin-operations-docs.test.ts
git diff --check
```

Expected: every contract is present; no whitespace errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/admin-operations-docs.test.ts README.md WORK_REPORT.md
git commit -m "docs: document admin UI operations rollback"
```

### Task 9: Final integration, browser smoke, and release review

**Files:**
- Modify only if verification exposes a requirement-scoped defect.
- Update `WORK_REPORT.md` with actual, not assumed, final results.

- [ ] **Step 1: Run focused UI/domain suites**

```bash
npm test -- \
  src/features/admin-messages/presentation.test.ts \
  src/features/admin-dashboard/alerts.test.ts \
  src/features/admin-dashboard/read-model.test.ts \
  'src/app/admin/(protected)/messages/contact-status-badge.test.tsx' \
  'src/app/admin/(protected)/messages/message-form.test.tsx' \
  'src/app/admin/(protected)/messages/messages-page.test.tsx' \
  'src/app/admin/(protected)/admin-dashboard.test.tsx' \
  'src/app/admin/(protected)/admin-loading.test.tsx' \
  'src/app/admin/(protected)/admin-error.test.tsx' \
  'src/app/admin/(protected)/admin-nav.test.ts' \
  src/app/admin/admin-operations-docs.test.ts \
  src/app/admin/admin-accessibility.test.tsx \
  src/app/admin/admin-styles.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the DB-gated suite when a safe URL exists**

```bash
ADMIN_OPERATIONS_TEST_DATABASE_URL="postgresql://localhost/foundation_test" \
  npm test -- src/features/admin-operations.integration.test.ts
```

If no safe local `_test` URL exists, record SKIPPED/unavailable; never point the
suite at a non-test database.

- [ ] **Step 3: Run the complete release gate**

Use non-secret build-only values:

```bash
DATABASE_URL="postgresql://test:test@localhost:5432/foundation_test" \
DATABASE_URL_UNPOOLED="postgresql://test:test@localhost:5432/foundation_test" \
ADMIN_USERNAME="build-admin" \
ADMIN_PASSWORD="build-password" \
AUTH_SECRET="build-only-secret-0123456789abcdef" \
ADMIN_TRUST_PROXY="false" \
PAYMENTS_ENABLED="false" \
NEXT_PUBLIC_SITE_URL="https://fond-bit-dobru.ru" \
SITE_URL="https://fond-bit-dobru.ru" \
npm run verify
```

Expected: tests, lint, typecheck, Prisma validate, production build, staged and
unstaged whitespace checks all PASS. Record exact counts and any pre-existing
warning.

- [ ] **Step 4: Audit dependencies**

Run: `npm audit --omit=dev` and `npm audit`.

Expected: production audit has zero vulnerabilities. Record dev-only findings;
do not use `--force` or accept a breaking dependency change solely to silence a
toolchain advisory.

- [ ] **Step 5: Smoke-test 1440×900 and 390×844 when safe runtime data exists**

Start the production build with a safe test database and local admin
credentials. Log in, then inspect dashboard, contact list, filters, numeric
pagination, detail, reply link, loading/error behavior, keyboard focus, and
`document.documentElement.scrollWidth <= window.innerWidth` at both viewports.
Run axe in the authenticated pages if the browser environment supports it.

If safe runtime data/credentials do not exist, do not fabricate them against an
unknown database; record the browser smoke as not run.

- [ ] **Step 6: Update actual release evidence and rerun doc checks**

Update `WORK_REPORT.md` with exact test/skip/audit/browser results.

Run: `git diff --check && git status --short`.

- [ ] **Step 7: Request two-stage final review**

Request a spec-compliance review of L1–L13 and then a code-quality/security
review of the complete branch diff. Address verified findings with a failing
test first and rerun `npm run verify`.

- [ ] **Step 8: Commit every review fix**

For each verified review finding, stage the exact changed source/test files,
commit the scoped fix, and rerun the affected test. Do not leave fixes only in
the working tree.

- [ ] **Step 9: Commit final evidence and prove a clean tree**

```bash
git add WORK_REPORT.md
git commit -m "docs: record admin UI release verification"
git status --short
```

Expected: no output from `git status --short`.

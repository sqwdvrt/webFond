# Admin Operations UI Design

**Date:** 17 October 2026  
**Status:** Approved for planning  
**Scope:** L1–L13 on top of the completed T1–T10 admin operations release

## Goal

Complete the server-rendered administration UI for contact requests and the
operations dashboard without adding a client data API or exposing private data.
The result must be usable at 390×844 and 1440×900, keyboard-accessible, and
explicit about empty, loading, invalid-filter, and transient-error states.

## Chosen approach

Extend the existing server-first App Router implementation. Filters and page
selection remain GET query parameters, pages read through the existing server
repositories/read model, and mutations remain server actions. The contact list
uses a semantic table on desktop and CSS changes the same rows into labelled
cards on narrow screens, so there is one DOM/data representation and no
horizontal page overflow.

This is preferred to a client-side data grid because it preserves the existing
authentication boundary, avoids a second API surface, keeps personally
identifying search terms out of client fetch logs, and requires less state.

## Existing foundation

The T1–T10 release already provides:

- `SPAM`, private notes, optimistic concurrency, and safe audit events;
- validated URL filters, 25-row server pagination, counts, and trigram search;
- detail and edit pages, a safe encoded email address, dashboard read model,
  Moscow donation aggregates, alert rules, and a server-provided NEW badge;
- invalid-filter and empty states, a protected-route error boundary, axe/CSS
  tests, and release documentation.

L1–L13 therefore refine and complete the presentation. They do not introduce a
new persistence model or public endpoint.

## Components and page behavior

### L1: contact status badge

Create one reusable `ContactStatusBadge` component for `NEW`, `IN_PROGRESS`,
`CLOSED`, and `SPAM`. It owns the Russian labels «Новое», «В работе»,
«Закрыто», and «Спам», and applies a status-specific class. Text always conveys
the state; color is supplementary. The CSS uses high-contrast foreground,
background, and border combinations in both normal and forced-colors modes.

The list and detail page use this component. One exported label map is the
canonical source for the badge, filter `<option>` elements, edit-form `<option>`
elements, and dashboard activity descriptions. No page keeps a second copy of
the four labels.

### L2–L4: filters, table, and pagination

The list remains a GET form with `q`, `status`, `from`, and `to`. «Применить»
submits the form and «Сбросить» links to `/admin/messages`. The server remains
the source of truth for normalized values, so refresh, sharing, browser history,
and pagination retain the same state.

The result is a semantic `<table>` with columns:

1. name;
2. email as a safely encoded `mailto:` link;
3. Moscow creation date and time;
4. status badge;
5. a whitespace-normalized message excerpt capped at 180 Unicode code points;
6. a descriptive link to the protected detail page.

On screens below the admin mobile breakpoint, CSS makes each row a card and
adds visible labels using `data-label`. The table keeps its header for assistive
technology, long names/emails/messages wrap, and the page does not acquire a
horizontal scrollbar.

Pagination renders «Назад», «Далее», the current page with `aria-current`, and a
bounded numeric window. For long ranges it includes first/last pages and inert
ellipses. Every link is built by the existing canonical query builder, retaining
all active filters and omitting `page=1`.

### L5–L6: contact detail and reply

The detail view shows the contact name, displayed email address, full message,
status badge, private note editor, creation time, and last-modified time in
Europe/Moscow. The mutation keeps the canonical `updatedAt` hidden token and
existing conflict feedback.

«Ответить по email» is a regular `mailto:` link. Both the address and subject
are encoded as separate components; the fixed Russian subject contains no
message text, private note, or other user input. The application never sends
email automatically.

### L7: dashboard metrics

Extend the single dashboard read model with:

- NEW contact count;
- IN_PROGRESS contact count labelled «Активные обращения»;
- successful donation count and amount for today in Europe/Moscow;
- successful donation count and amount for the current Moscow month;
- published project count (`Project.status = PUBLISHED`);
- total draft content count across projects, news, and documents.

The page receives this one model after session validation. UI components do not
query Prisma or fetch an API.

### L8: recent actions

Change the current repository limit from 20 to exactly ten events and assert
`take: 10` in its test. Narrow the allow-listed dashboard projection by removing
the unused `entityId`; retain the audit event `id` only as the React list key.
Each entry shows Moscow date/time, a safe entity type label, and a description
built only from action plus allow-listed previous/next status. Entity IDs,
titles, contact names, email, notes, and content are neither selected nor
rendered.

### L9: warnings

The alert read model adds a safe `href` selected by alert code, never by stored
personal data:

- stale NEW contacts → `/admin/messages?status=NEW`;
- stale PENDING donations → `/admin/donations?status=PENDING`;
- readiness configuration → `/api/ready`, whose public response remains the
  existing safe boolean readiness result and does not expose issue codes.

Status-only links intentionally show a superset because the current date-only
filters cannot represent an exact 48-hour or one-hour instant without either
excluding stale records or including newer records unpredictably. The warning
text retains the exact count and threshold.

Warnings use the explicit priority order: readiness configuration first, stale
PENDING donations second, stale NEW contacts third. The entire warning title is
a keyboard-focusable link with a descriptive accessible name. Tests assert the
order and exact constant href for each code.

### L10: navigation badge

Retain the server-provided NEW count. It is absent when zero. When non-zero,
visible digits are hidden from duplicate screen-reader announcement and the
link receives one complete accessible name including the count.

## L11: states and failures

- No results: retain the calm empty state and offer filter reset.
- Invalid query: retain the authenticated invalid-filter page; no repository
  query runs.
- Loading: add route-level loading UI for the message list and dashboard. It
  uses stable non-animated text/skeleton blocks, `aria-busy`, and no fabricated
  counts.
- Temporary data error: use route error boundaries with a neutral message and a
  retry button. They do not include thrown error text, query parameters, or
  personal data.
- Mutation validation/conflict: retain inline field errors and the existing
  explicit optimistic-concurrency message.

## L12: accessibility and responsive behavior

- Native form labels, table semantics, headings, landmarks, and link/button
  elements are used before ARIA.
- Focus indicators remain visible for every interactive element; touch targets
  are at least 44 CSS pixels where layout permits.
- Status is never communicated by color alone. Decorative icons are hidden.
- Long untrusted strings use safe wrapping and cannot cover adjacent controls.
- Automated tests cover keyboard tab order for the filter controls, status
  accessible names, current-page semantics, serious/critical axe findings, and
  CSS contracts for 390×844 and 1440×900.
- A real browser smoke test verifies no page-level horizontal overflow and the
  primary list/detail/dashboard paths at both viewports when safe local admin
  credentials and a test database are available. If unavailable, the release
  report records the check as not run rather than passed.

## L13: migration and rollback documentation

Update the operator documentation with:

- the admin operations migration prerequisites and `pg_trgm` ownership rule;
- integration-test commands and the exact warning thresholds (48 hours for NEW
  contacts, one hour for PENDING donations);
- forward-fix as the preferred recovery because the migration is additive;
- an application rollback must use a prepared compatibility build generated
  with the `SPAM` enum value even if it omits the new UI. The original
  pre-migration artifact must not be restored after any row may have used
  `SPAM`, because its generated Prisma client cannot safely decode that value;
- if no compatibility build exists, restoring the original artifact requires a
  backup, a maintenance window, an explicit count of `SPAM` rows, and an
  approved transactional remediation of every such row to the legacy
  `IN_PROGRESS` status before deployment. This lossy emergency path is recorded
  in the operator change log and is not automated;
- why `SPAM` cannot be removed from a PostgreSQL enum safely during an emergency
  rollback, and why destructive down SQL is not supplied;
- a later cleanup procedure requiring a backup, proof that no rows use the new
  status/columns, and a separately reviewed maintenance migration.

## Data flow and security boundaries

1. The protected layout/session check runs before query parsing or repository
   access.
2. The server validates query parameters and canonicalizes clamped page values.
3. Repositories return only the fields needed by their page/read model; recent
   activity does not select `entityId`.
4. Server components render the list/dashboard. There is no client list fetch.
5. Server actions validate the session before form parsing and update by
   `id + updatedAt` inside the existing audit transaction.
6. User-controlled strings are rendered as React text. They are never inserted
   into HTML, CSS, audit descriptions, or warning URLs.

## Test strategy

Use test-driven changes in small groups:

- component tests for status labels, filters, table cells, mail links, numeric
  pagination, detail metadata, and all states;
- read-model repository tests for active contacts, published projects, aggregate
  drafts, ten safe activities, and alert links;
- axe tests for list, detail, dashboard, loading, empty, and error UI;
- CSS contract tests for breakpoints, wrapping, focus, forced colors, and no
  overflow-causing fixed widths;
- route tests proving authentication happens before query/data work;
- DB-gated integration coverage for aggregate queries where a safe local
  PostgreSQL `_test` database is provided;
- final `npm run verify`, production dependency audit, and documented browser
  smoke result.

## Acceptance mapping

| Requirement | Acceptance evidence |
| --- | --- |
| L1 | One badge and one canonical four-label map across all consumers; contrast/forced-color tests |
| L2 | GET controls, Apply/Reset, URL persistence tests |
| L3 | Six-column semantic table and responsive-row tests |
| L4 | Previous/next/numbers, `aria-current`, preserved filters |
| L5 | Name, displayed email, full message, status, note, created/updated Moscow times |
| L6 | Encoded address and fixed encoded subject; no send path |
| L7 | Six metric groups from one authenticated read model |
| L8 | Repository changes `take: 20` to `take: 10`; safe events contain no entity IDs/PII |
| L9 | Explicit readiness → donations → contacts order and exact code-derived status-only links |
| L10 | Zero hidden, non-zero announced once |
| L11 | Empty, invalid, loading, error, conflict coverage |
| L12 | 390×844 and 1440×900 contracts, keyboard, focus, axe, overflow |
| L13 | Migration, tests, thresholds, and non-destructive rollback docs |

## Out of scope

- sending email or integrating an email provider;
- bulk contact actions, export, sorting, saved filters, or live polling;
- exposing audit entity IDs or contact data in activity descriptions;
- a new client-side admin API or reusable third-party data-grid dependency;
- destructive automatic rollback of the additive database migration.

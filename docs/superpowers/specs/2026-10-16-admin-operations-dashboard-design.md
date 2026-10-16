# Admin Operations Dashboard Design

## Goal

Deliver the administrative operations release described by T1-T10: a searchable
and safely editable contact-request queue, privacy-safe audit history, a single
dashboard read model, Moscow-calendar donation metrics, operational alerts, a
server-rendered new-request badge, and release verification.

## Constraints and decisions

- Keep the existing Next.js App Router, server action, Prisma, and PostgreSQL
  patterns.
- Use server components for all protected reads. Do not add a client API for the
  dashboard or navigation badge.
- Treat `AdminAuditEvent` as a record of authenticated administrative actions.
  Public contact-form submissions are represented by `ContactRequest.createdAt`
  and are not duplicated in the admin audit log.
- Do not store contact names, email addresses, messages, internal-note bodies,
  content titles, slugs, requisites, credentials, secrets, request bodies, or
  arbitrary JSON in audit rows.
- The application currently has one configured administrator. Audit rows store a
  non-personal actor kind (`ADMIN`) rather than the configured username.
- Mutation and audit insertion must be atomic. A successful database change
  without its audit event, or an audit event without its change, is invalid.
- Calendar filters and donation periods use `Europe/Moscow` and half-open UTC
  intervals: `[start, end)`.
- Use numbered pagination with 25 rows because the requirement includes result
  counts and page navigation. Clamp out-of-range pages to the last valid page.

## Alternatives considered

### 1. Atomic feature modules and server read models — selected

Build focused modules for contact filters, contact mutations, audit events,
dashboard queries, Moscow time boundaries, alerts, and readiness. Database
mutations and audit writes run in one transaction. This matches the repository's
existing separation between parsing, mutation orchestration, repositories, and
server UI while keeping each unit directly testable.

### 2. Add logic directly to existing pages and server actions

This would require fewer files, but query validation, privacy rules, and audit
creation would be duplicated. Writing audit rows after repository mutations would
also create a consistency gap.

### 3. Domain-event outbox

An outbox would support asynchronous consumers and multi-service delivery, but
there is no such consumer in this application. It would add failure modes and
operational work without helping the requested release.

## Data model and migration

Extend `ContactRequestStatus` with `SPAM` and add nullable
`ContactRequest.internalNote`. Existing rows keep their current status and receive
`NULL` notes. Replace the current contact list index with a stable pagination index
on `(status, createdAt, id)` and add `(createdAt, id)` for unfiltered date-ordered
pages.

Search uses case-insensitive substring matching across `name`, `email`, and
`message`. PostgreSQL `pg_trgm` GIN indexes support those `%term%` predicates. The
migration enables `pg_trgm` with `CREATE EXTENSION IF NOT EXISTS` and creates one
GIN index per searched column. Migration tests must prove the extension/indexes
exist and that legacy rows survive unchanged.

Add enum-backed `AdminAuditEvent` fields:

- `id`, `createdAt`;
- `actorKind = ADMIN`;
- `action`;
- `entityType`;
- `entityId`;
- optional `previousStatus` and `nextStatus` strings.

Allowed actions are `CONTENT_CREATED`, `CONTENT_PUBLISHED`,
`CONTENT_ARCHIVED`, `CONTENT_STATUS_CHANGED`, `CONTENT_DELETED`,
`CONTACT_STATUS_CHANGED`, and `CONTACT_NOTE_CHANGED`. Allowed entity types are
`PROJECT`, `NEWS_POST`, `DOCUMENT`, and `CONTACT_REQUEST`. The audit table has
indexes on `(createdAt, id)` for recent activity and `(entityType, entityId,
createdAt)` for entity history. There is deliberately no JSON payload or free-text
description column.

Creating content writes `CONTENT_CREATED`; creating it directly as published or
archived additionally writes the corresponding lifecycle event. Status transitions
write the specific publish/archive action or `CONTENT_STATUS_CHANGED`. Deleting a
permitted draft writes `CONTENT_DELETED`. Content changes that do not affect the
required lifecycle are not audited.

## Contact-request list

Create a dedicated admin-messages feature module rather than expanding the public
contact feature. Its parser accepts exactly one value for each of `status`, `from`,
`to`, `q`, and `page`, rejects unknown enum values, invalid calendar dates,
duplicate parameters, queries over 120 characters, and pages outside the bounded
positive-integer format.

Dates are interpreted as Moscow calendar dates and converted to UTC. The
repository builds one Prisma `where` object, then runs `count` and `findMany` in a
repeatable-read transaction. Rows are ordered by `(createdAt DESC, id DESC)`, and
the query selects only fields needed by the page. The result contains rows, total,
page, total pages, and page size 25.

The server page authenticates before parsing or querying. Invalid filters render a
safe error state. If the requested page is beyond the result set, the page redirects
to the last valid page while preserving valid filters. The UI contains server-side
filters, the result count, pagination, status badges, and an edit form for each
selected request. Mobile rendering uses stacked cards; desktop may use a table or
two-column list/detail layout, following existing admin styles.

## Contact-request mutation

The server action requires an admin session before validation or database access.
The form accepts `id`, `updatedAt`, one status, and a note of at most 4,000
characters. Whitespace-only notes normalize to `NULL`.

Inside one database transaction the repository:

1. reads the current status and whether a note exists;
2. updates with `WHERE id = ? AND updatedAt = ?`;
3. returns `missing` or `conflict` when no row is updated;
4. adds `CONTACT_STATUS_CHANGED` when the status actually changed;
5. adds `CONTACT_NOTE_CHANGED` when the normalized note actually changed, without
   copying either note value into the audit row.

The action returns validation errors with safe submitted values and a clear
conflict message instructing the administrator to refresh. Success revalidates the
message list and dashboard and redirects back to the edited request.

## Atomic content audit

Content server actions pass only `actorKind: ADMIN` from the authenticated session
boundary. Existing repository operations are adapted to accept a transaction
client. A thin audited repository layer opens the transaction, calls the existing
minimal content operation, derives lifecycle events from the previous and next
status already returned by the operation, and inserts audit rows before commit.

Unique-slug errors, missing rows, optimistic conflicts, and forbidden deletes keep
their current user-facing semantics and write no audit row. Audit insertion failure
rolls the content mutation back.

Requisites updates are intentionally outside the requested audit action set: they
have no publication status and may contain sensitive legal or banking data. This
avoids inventing a generic metadata-bearing event.

## Dashboard read model

`getAdminDashboardReadModel(now)` is the only data-loading entry point used by the
dashboard page. It returns:

- count of `NEW` contact requests;
- count and kopeck sum of `SUCCEEDED` donations today;
- count and kopeck sum of `SUCCEEDED` donations in the current month;
- evaluated alert summaries;
- a bounded recent audit-event list containing only safe fields.

Database reads execute in one repeatable-read transaction so counters and recent
activity describe one snapshot. Aggregates use `paidAt`, not `createdAt`, because
the metric is successful donations during a period. Only `SUCCEEDED` rows with a
non-null `paidAt` contribute.

The admin dashboard page performs its existing session check and then calls this
single loader. Presentation components receive the read model as props and issue no
database queries.

## Moscow time boundaries

A shared pure helper converts a supplied instant to these UTC intervals for
`Europe/Moscow`:

- current local day start to next local day start;
- current local month start to next local month start;
- arbitrary inclusive calendar-date filters converted to `[from, day-after-to)`.

Tests cover moments immediately before and after Moscow midnight, month changes,
year changes, and exact SQL boundaries. The implementation uses `Intl` time-zone
parts rather than the host's local time zone.

## Alerts and readiness

Alert rules are pure functions receiving counts/ages/configuration results:

- stale contacts: status `NEW` and `createdAt < now - 48 hours`;
- stale donations: status `PENDING` and `createdAt < now - 1 hour`;
- readiness: one safe warning per readiness problem code.

Exactly 48 hours and exactly 1 hour are not “older than” and therefore do not
alert; the database predicates use strict `lt` boundaries.

Extract the current admin readiness check into a reusable evaluator that returns
safe issue codes and is consumed by both `/api/ready` and the dashboard. No secret
or configured value appears in the result. The HTTP route keeps `{ ok: true }` or
`{ ok: false }` and status 503 compatibility.

## Navigation badge

The protected server layout loads only the number of `NEW` requests after session
validation and passes it to `AdminShell`, then to `AdminNav`. The client navigation
component renders the number with an accessible label and does not fetch data.
Only the aggregate count crosses the server/client boundary.

The dashboard's richer read model remains separate from the shell query so every
protected route does not pay for dashboard aggregates. The count query is small and
uses the contact status index.

## Error handling and privacy

- Every protected read/action authenticates before parsing request data or touching
  the database.
- Expected validation, duplicate, conflict, missing, and forbidden outcomes are
  represented as typed results; unexpected database failures propagate to the
  existing protected error boundary.
- Admin responses remain private and `no-store` through the existing route policy.
- Search terms may contain PII and remain in protected query strings; the existing
  production rule to suppress `/admin` query strings in access logs still applies.
- Audit types and insert helpers do not accept arbitrary payloads, making it
  structurally impossible for current call sites to add message/note bodies or
  secrets.

## Testing and release verification

Implementation follows red-green-refactor. Unit tests cover parsers, UTC boundary
helpers, alert thresholds, audit event derivation, action authorization order,
optimistic conflicts, dashboard mapping, and accessible rendering. Repository tests
assert Prisma query shapes and transactional audit writes.

A PostgreSQL integration test creates an isolated schema in a database whose host
is local and whose name ends in `_test`. It applies the migration to a legacy
fixture, verifies data preservation and defaults, exercises indexed filters and
aggregates at exact UTC boundaries, and proves emitted audit rows contain only the
allow-listed columns and statuses. It always cleans up its schema.

Release verification consists of:

1. focused tests during each TDD cycle;
2. the full unit suite, lint, typecheck, Prisma validation, and production build;
3. the database-backed migration/integration test when a safe local test URL is
   available;
4. `npm audit` review, query/index review, and inspection for PII-bearing audit
   fields;
5. authenticated desktop and mobile smoke tests for dashboard, message filters,
   pagination, edits, conflicts, badge, and responsive layout.

Any unavailable external prerequisite (local PostgreSQL, production credentials,
or running browser environment) is reported explicitly rather than silently
treated as a passing check.

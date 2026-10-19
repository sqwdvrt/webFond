# Admin Notifications Implementation Plan

**Goal:** Move operational warnings from Overview into a top navigation Notifications section with the count of active warnings.

**Approved design:** Add a bell and «Уведомления» link after Overview; hide its badge when zero. Preserve warning order, destination links and reconciliation status on /admin/notifications. The activity feed is removed from Overview; the existing Changes tab provides the full journal. Viewing a warning does not clear it; resolving its cause removes it on the next server refresh. No database migration or persistent inbox is needed.

**Architecture:** Reuse buildOperationalAlerts and the reconciliation heartbeat parser in a small server read model. Read only stale contact/donation counts and heartbeat, cached per server request so the layout and notifications page share the same result. Authenticate before querying. Keep dashboard metrics and the full activity journal unchanged.

**Tech Stack:** Next.js App Router, React, Prisma, Vitest, Testing Library.

- [x] Update dashboard and navigation behavior tests; verify they fail before implementation.
- [x] Add notifications page tests for warning links, empty state, heartbeat and authentication.
- [x] Add focused read-model tests covering query filters and disabled payments.
- [x] Implement the read model, route and server count propagation through layout/shell/nav.
- [x] Remove warnings, activity feed and two-column wrapper from Overview.
- [x] Run affected tests, lint, typecheck and production build; review diff.

**Validation:** Focused checks passed (246 tests). ESLint, TypeScript and the production build passed; /admin/notifications is included as a dynamic protected route. Full suite rerun after the message cache invalidation change.

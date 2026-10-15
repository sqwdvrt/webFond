# Admin Release 1: Foundation Hardening Design

## Goal

Make the existing administration area reliable and comfortable enough for daily
use by one or two foundation employees before adding new workflows. The release
fixes the current form and lint defects, improves mobile navigation and keyboard
access, hardens response headers, and exposes a deployment-readiness check for
the mandatory administrator configuration.

## Scope

This release changes the existing administrator experience only. It does not add
dashboard metrics, message statuses, content preview, multiple administrator
accounts, roles, two-factor authentication, or a new editor. Those remain later
releases.

The implementation must preserve the current public site, database schema,
authentication format, content mutation behavior, and upload API contract.

## User experience

### Content forms

All text inputs, text areas, and selects use the same visual language: visible
border, white surface, readable padding, inherited typography, and a clear focus
ring. Invalid controls use the existing error color. Text areas remain vertically
resizable and have a practical minimum height. File inputs keep their compact
native behavior.

The image and document URL field continues to support both manual URLs and file
uploads. Its local state is initialized from the server-provided value without a
synchronous state update inside an effect. A failed submission must preserve the
URL shown to the user, and a successful upload must replace it with the returned
URL.

### Mobile administrator navigation

The navigation remains a horizontal strip rather than introducing a new drawer
or menu. This is the smallest change and preserves the existing information
architecture. On viewports up to 720 pixels, the strip uses fixed 24-pixel
left/right gradient overlays above the scrolling content to indicate that more
items may be available; the overlays ignore pointer events. Whenever the route
changes or a deep administrator URL is opened directly, the active item is
scrolled into view with nearest-block and center-inline alignment. Desktop
behavior remains unchanged.

### Keyboard navigation

Authenticated administrator pages gain a skip link as the first focusable item.
It targets a semantic `main` element containing the route content. The skip link
is visually hidden until focused and must remain visible above the sticky header.
Existing focus states and native keyboard behavior remain intact.

## Runtime readiness

`GET /api/health` remains a lightweight liveness endpoint returning `200`. It
must not become dependent on the database or administrator credentials because
Timeweb can use it to decide whether to restart the whole public application.

A separate `GET /api/ready` endpoint validates the server configuration required
for administrator login by calling the existing configuration parser. It returns:

- `200` with `{ "ok": true }` when the configuration is valid;
- `503` with `{ "ok": false }` when configuration is absent or invalid.

The response must not identify the missing variable or expose any configured
value. Both responses use `Cache-Control: no-store`, `Referrer-Policy:
no-referrer`, `X-Content-Type-Options: nosniff`, and JSON content type. Database
connectivity is deliberately excluded from this first readiness check because
the repository already has independent integration coverage and a database probe
could make deployment health sensitive to transient network failures.

## Response security

All administrator routes retain their current privacy headers and add:

- `X-Frame-Options: DENY`;
- `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

This release intentionally limits CSP to navigation and embedding protections.
A strict script/style CSP for a Next.js application needs a nonce strategy and
is a separate change. `Strict-Transport-Security` is added globally for the
production domain through Next.js headers with `max-age=31536000;
includeSubDomains`; it is safe for this HTTPS-only deployment but must not add
`preload` until every subdomain has been audited. The Next.js header rule is
included only when `process.env.NODE_ENV === "production"`; development responses
must not emit HSTS.

## Build and deployment gate

The authoritative local release gate is one script named `verify` that runs, in
order:

1. unit and component tests;
2. ESLint;
3. TypeScript checking;
4. Prisma schema validation;
5. production build;
6. `git diff --check`.

The script stops on the first failure through npm's command chaining. Existing
specialized integration tests remain opt-in because they require external test
databases. Documentation must state that `npm run verify` is required before a
production deployment.

## Testing

Tests are added or extended before implementation for:

- shared input, text-area, and select styling hooks;
- invalid and focus-visible form states;
- media URL initialization, manual editing, failed upload, and successful upload;
- the active navigation item and its scroll-into-view behavior;
- the administrator skip link and semantic `main` landmark;
- all administrator security headers;
- successful and failed readiness checks without leaking variable names;
- presence and ordering of the `verify` script.

The final browser check covers the login screen, overview, and new project form
at desktop width and at 390 by 844 pixels. It verifies keyboard focus order,
skip-link behavior, visible form boundaries, the active navigation item, and
horizontal navigation affordance.

## Failure handling

- Upload failures retain the typed URL and show the existing safe error message.
- Invalid administrator configuration makes `/api/ready` return a generic `503`
  response; `/api/health` and the public site stay available.
- Security headers are declared in one reusable constant or helper so tests and
  route configuration cannot drift independently.
- No test or runtime log prints credentials, secrets, or complete environment
  contents.

## Acceptance criteria

- Text areas and selects are as clearly visible and usable as text inputs.
- `npm run lint` has no errors.
- Direct navigation to every administrator section shows the active mobile tab.
- Keyboard users can bypass the administrator header and navigation.
- `/api/health` still returns `200` without administrator configuration.
- `/api/ready` returns `503` for invalid configuration and `200` for valid
  configuration without leaking configuration details.
- Administrator responses include the agreed framing, form-action, base URI,
  permissions, privacy, and content-type protections.
- `npm run verify` passes from a clean checkout with the required environment.
- Existing public and administrator tests continue to pass.


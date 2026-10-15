# Admin Release 1 Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing administrator area visually reliable, keyboard-accessible, deployment-ready, and protected by a repeatable verification gate.

**Architecture:** Preserve the existing App Router and authentication boundaries. Make small, independently tested changes to shared admin CSS/components, add a configuration-only readiness route beside the existing liveness route, centralize response construction and security-header definitions, then expose one documented verification command.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library, axe-core, Prisma, npm.

---

## File map

### Create

- `src/app/admin/admin-styles.test.ts` — structural CSS contract for shared controls, invalid states, focus states, skip link, and mobile navigation affordance.
- `src/app/admin/(protected)/media-url-field.test.tsx` — focused upload/URL state tests.
- `src/lib/http/private-json-response.ts` — reusable private JSON response helper for health endpoints.
- `src/lib/http/private-json-response.test.ts` — response helper contract.
- `src/app/api/ready/route.ts` — configuration readiness endpoint.
- `src/app/api/ready/route.test.ts` — readiness success, failure, and information-leak tests.
- `src/config/verification.test.ts` — package-script and README verification-gate contract.

### Modify

- `src/app/admin/admin.module.css` — shared control styles, focus/invalid states, skip link, and mobile navigation gradients.
- `src/app/admin/(protected)/media-url-field.tsx` — remove the lint-breaking prop-sync effect.
- `src/app/admin/(protected)/projects/project-form.tsx` — key the media field by the server-provided URL.
- `src/app/admin/(protected)/news/news-form.tsx` — key the media field by the server-provided URL.
- `src/app/admin/(protected)/documents/document-form.tsx` — key the media field by the server-provided URL.
- `src/app/admin/(protected)/admin-nav.tsx` — scroll the active navigation item into view.
- `src/app/admin/(protected)/admin-nav.test.ts` — verify active-link scrolling.
- `src/app/admin/(protected)/admin-shell.tsx` — add skip link and semantic main landmark.
- `src/app/admin/(protected)/admin-shell.test.tsx` — verify the landmark, skip target, and accessibility.
- `src/app/api/health/route.ts` — use the shared response helper without changing liveness behavior.
- `src/app/api/health/route.test.ts` — retain the liveness contract after refactoring.
- `next.config.ts` — export deterministic header construction and add admin/HSTS protections.
- `src/app/admin/admin-headers.test.ts` — verify development/production header rules.
- `package.json` — add the ordered `verify` command.
- `README.md` — document readiness and the deployment gate.

## Task 1: Make administrator form controls visible and consistent

**Files:**
- Create: `src/app/admin/admin-styles.test.ts`
- Modify: `src/app/admin/admin.module.css`

- [ ] **Step 1: Write the failing shared-style contract**

Add a test that reads `admin.module.css` and requires a shared rule covering
`.field input`, `.field textarea`, and `.field select`. Assert that the rule has
`width: 100%`, visible border/background, inherited font, and error/focus rules
for all three control types. Also require `resize: vertical` and a minimum height
for text areas.

```ts
expect(css).toMatch(
  /\.field input,\s*\.field textarea,\s*\.field select\s*\{[^}]*width:\s*100%[^}]*border:\s*1px solid #aeb7b0[^}]*font:\s*inherit/s,
);
expect(css).toMatch(/\.field textarea\s*\{[^}]*min-height:[^}]*resize:\s*vertical/s);
expect(css).toContain(':focus-visible');
expect(css).toContain('[aria-invalid="true"]');
```

- [ ] **Step 2: Run the style test and verify RED**

Run: `npm test -- src/app/admin/admin-styles.test.ts`

Expected: FAIL because only `.field input` is styled.

- [ ] **Step 3: Implement the shared control styles**

In `admin.module.css`, share width, color, background, border, radius, font, and
font weight across inputs/textareas/selects. Keep `min-height: 50px` and
horizontal padding for inputs/selects; give textareas `min-height: 112px`,
padding `12px 14px`, `line-height: 1.5`, and `resize: vertical`. Apply the error
border and a two-pixel focus-visible outline to all control types. Preserve the
special file-input override.

- [ ] **Step 4: Run the style and form suites and verify GREEN**

Run:

```bash
npm test -- src/app/admin/admin-styles.test.ts \
  'src/app/admin/(protected)/projects/projects-admin.test.tsx' \
  'src/app/admin/(protected)/news/news-admin.test.tsx' \
  'src/app/admin/(protected)/documents/documents-admin.test.tsx' \
  'src/app/admin/(protected)/requisites/requisites-admin.test.tsx'
```

Expected: PASS.

- [ ] **Step 5: Commit the form styling**

```bash
git add src/app/admin/admin.module.css src/app/admin/admin-styles.test.ts
git commit -m "fix: style admin form controls consistently"
```

## Task 2: Remove the media-field lint failure without losing submitted values

**Files:**
- Create: `src/app/admin/(protected)/media-url-field.test.tsx`
- Modify: `src/app/admin/(protected)/media-url-field.tsx`
- Modify: `src/app/admin/(protected)/projects/project-form.tsx`
- Modify: `src/app/admin/(protected)/news/news-form.tsx`
- Modify: `src/app/admin/(protected)/documents/document-form.tsx`

- [ ] **Step 1: Write focused media-field tests**

Mock `fetch` and cover:

- initial rendering from `value`;
- manual URL editing;
- successful upload replacing the URL with the response URL;
- failed upload preserving the typed URL and showing the neutral error;
- busy text and disabled file input while the request is pending.

Use `userEvent.upload` with an in-memory JPEG/PDF fixture and restore the global
fetch mock after each test.

- [ ] **Step 2: Run the focused test and the linter to verify the current failure**

Run:

```bash
npm test -- 'src/app/admin/(protected)/media-url-field.test.tsx'
npm run lint
```

Expected: the new behavior tests pass or expose missing busy coverage, while
lint fails at the synchronous `setUrl(value)` effect.

- [ ] **Step 3: Replace effect synchronization with keyed initialization**

Remove `useEffect` and initialize local state once with `useState(value)`. Add
`key={String(value("imageUrl"))}` to project/news `MediaUrlField` calls and
`key={String(value("fileUrl"))}` to the document call. The existing action-state
integration tests prove that submitted server values survive a failed save; the
key remount handles a server-returned normalized value without an effect.

- [ ] **Step 4: Run focused, integration, and lint checks**

Run:

```bash
npm test -- 'src/app/admin/(protected)/media-url-field.test.tsx' \
  'src/app/admin/(protected)/projects/project-form.integration.test.tsx' \
  'src/app/admin/(protected)/news/news-form.integration.test.tsx' \
  'src/app/admin/(protected)/documents/documents-admin.test.tsx'
npm run lint
```

Expected: PASS with only any pre-existing non-blocking warning.

- [ ] **Step 5: Commit the media-field repair**

```bash
git add 'src/app/admin/(protected)/media-url-field.tsx' \
  'src/app/admin/(protected)/media-url-field.test.tsx' \
  'src/app/admin/(protected)/projects/project-form.tsx' \
  'src/app/admin/(protected)/news/news-form.tsx' \
  'src/app/admin/(protected)/documents/document-form.tsx'
git commit -m "fix: stabilize admin media url state"
```

## Task 3: Improve mobile navigation and keyboard access

**Files:**
- Modify: `src/app/admin/(protected)/admin-nav.tsx`
- Modify: `src/app/admin/(protected)/admin-nav.test.ts`
- Modify: `src/app/admin/(protected)/admin-shell.tsx`
- Modify: `src/app/admin/(protected)/admin-shell.test.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `src/app/admin/admin-styles.test.ts`

- [ ] **Step 1: Write failing navigation and landmark tests**

In `admin-nav.test.ts`, mock `HTMLElement.prototype.scrollIntoView`, set
`usePathname` to `/admin/donations`, render `AdminNav`, and assert the current
link is scrolled with:

```ts
expect(scrollIntoView).toHaveBeenCalledWith({
  block: "nearest",
  inline: "center",
});
```

In `admin-shell.test.tsx`, change the existing negative `main` assertion to
require one `main` with `id="admin-main"`, plus a link named `К содержанию` with
`href="#admin-main"`.

Extend `admin-styles.test.ts` to require a focus-revealed skip link and the two
24-pixel mobile gradient pseudo-elements on a non-scrolling `.adminNavFrame`.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- 'src/app/admin/(protected)/admin-nav.test.ts' \
  'src/app/admin/(protected)/admin-shell.test.tsx' \
  src/app/admin/admin-styles.test.ts
```

Expected: FAIL because there is no scrolling effect, main landmark, skip link,
or gradient affordance.

- [ ] **Step 3: Scroll the active link into view**

Use one `useRef<HTMLAnchorElement>` and `useEffect` in `AdminNav`. Compute the
current state once per item, attach the ref only to the current link, and call
`scrollIntoView({ block: "nearest", inline: "center" })` whenever `pathname`
changes. This effect synchronizes with the DOM and does not update React state.

- [ ] **Step 4: Add the semantic main and skip link**

Place the skip link before the sticky header. Replace `.workspaceMain`'s `div`
with `<main className={styles.workspaceMain} id="admin-main" tabIndex={-1}>` so
the fragment target can receive programmatic focus. Add a reusable
`.adminSkipLink` style that is visually hidden offscreen and becomes fixed and
visible on focus with a z-index above the header. Assert the `tabindex` contract
in the shell test.

- [ ] **Step 5: Add deterministic mobile overflow affordances**

Wrap the scrolling `.adminNavViewport` in a non-scrolling, positioned
`.adminNavFrame`. Inside the existing max-width 720px media query, add
`::before` and `::after` 24-pixel pointer-transparent gradients to the frame at
the left and right edges. The gradients must remain pinned while the inner strip
scrolls. Use the header background color fading to transparent; do not cover
link click targets with pointer events.

- [ ] **Step 6: Run accessibility and navigation suites**

Run:

```bash
npm test -- 'src/app/admin/(protected)/admin-nav.test.ts' \
  'src/app/admin/(protected)/admin-shell.test.tsx' \
  src/app/admin/admin-accessibility.test.tsx \
  src/app/admin/admin-styles.test.ts
```

Expected: PASS with no serious or critical axe violations.

- [ ] **Step 7: Commit navigation and accessibility changes**

```bash
git add 'src/app/admin/(protected)/admin-nav.tsx' \
  'src/app/admin/(protected)/admin-nav.test.ts' \
  'src/app/admin/(protected)/admin-shell.tsx' \
  'src/app/admin/(protected)/admin-shell.test.tsx' \
  src/app/admin/admin.module.css src/app/admin/admin-styles.test.ts
git commit -m "feat: improve admin navigation accessibility"
```

## Task 4: Add a non-leaking administrator readiness endpoint

**Files:**
- Create: `src/lib/http/private-json-response.ts`
- Create: `src/lib/http/private-json-response.test.ts`
- Create: `src/app/api/ready/route.ts`
- Create: `src/app/api/ready/route.test.ts`
- Modify: `src/app/api/health/route.ts`
- Modify: `src/app/api/health/route.test.ts`

- [ ] **Step 1: Write the private JSON response tests**

Require the helper to serialize the supplied body and set:

```text
Cache-Control: no-store
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Content-Type: application/json
```

Test both default `200` and explicit `503` statuses.

- [ ] **Step 2: Run the helper test and verify RED**

Run: `npm test -- src/lib/http/private-json-response.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper and refactor liveness**

Implement `privateJsonResponse(body, status = 200)` and update `/api/health` to
return `privateJsonResponse({ ok: true })`. Keep the exact public liveness body
and status.

- [ ] **Step 4: Write readiness route tests**

Export a testable `checkReadiness(readConfig)` or `handleReadiness(readConfig)`
function. Test a valid injected config reader, an
`AdminAuthConfigurationError`, and an unexpected error. Configuration failures
return generic `{ ok: false }`/`503`; unexpected failures are rethrown so real
programming faults are not silently hidden. Assert response text contains no
environment variable name or supplied secret.

- [ ] **Step 5: Run readiness tests and verify RED**

Run: `npm test -- src/app/api/ready/route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 6: Implement the readiness route**

Call `readAdminAuthConfig`, discard the returned credentials, and produce only
`{ ok: true }` or `{ ok: false }`. Catch only
`AdminAuthConfigurationError`. Export `GET` with the real config reader.

- [ ] **Step 7: Run all endpoint tests**

Run:

```bash
npm test -- src/lib/http/private-json-response.test.ts \
  src/app/api/health/route.test.ts \
  src/app/api/ready/route.test.ts \
  src/lib/admin-auth/config.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit readiness support**

```bash
git add src/lib/http/private-json-response.ts \
  src/lib/http/private-json-response.test.ts \
  src/app/api/health/route.ts src/app/api/health/route.test.ts \
  src/app/api/ready/route.ts src/app/api/ready/route.test.ts
git commit -m "feat: add admin configuration readiness check"
```

## Task 5: Harden administrator response headers

**Files:**
- Modify: `next.config.ts`
- Modify: `src/app/admin/admin-headers.test.ts`

- [ ] **Step 1: Expand the failing header tests**

Export a pure `buildHeaders(environment)` contract from `next.config.ts` and
test it with `development` and `production`. Require the administrator rule to
include existing privacy headers plus:

```text
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Require exactly one global HSTS rule only in production, with
`max-age=31536000; includeSubDomains`, and no `preload` token.

- [ ] **Step 2: Run the header test and verify RED**

Run: `npm test -- src/app/admin/admin-headers.test.ts`

Expected: FAIL because the new headers and builder do not exist.

- [ ] **Step 3: Implement deterministic header construction**

Move current rules into `buildHeaders(environment)`. Add the new administrator
headers to `/admin/:path*`. Append the global HSTS rule only for `production`.
Have `nextConfig.headers()` delegate to `buildHeaders(process.env.NODE_ENV)`.
Keep `/donation/result` behavior unchanged.

- [ ] **Step 4: Run header, proxy, and build checks**

Run:

```bash
npm test -- src/app/admin/admin-headers.test.ts src/proxy.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit response hardening**

```bash
git add next.config.ts src/app/admin/admin-headers.test.ts
git commit -m "feat: harden admin response headers"
```

## Task 6: Add and document the release verification gate

**Files:**
- Create: `src/config/verification.test.ts`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write the failing verification contract**

Read `package.json` and require this exact script ordering:

```json
"verify": "npm test && npm run lint && npm run typecheck && npm run db:validate && npm run build && git diff --check"
```

Read `README.md` and require references to `npm run verify`, `/api/health` as
liveness, and `/api/ready` as configuration readiness.

- [ ] **Step 2: Run the verification contract and verify RED**

Run: `npm test -- src/config/verification.test.ts`

Expected: FAIL because the script and documentation are absent.

- [ ] **Step 3: Add the script and update documentation**

Add `verify` without changing specialized integration commands. Replace the
manual list in the Checks section with `npm run verify`, explaining that payment
and database-backed integration suites remain separate. In the Timeweb section,
keep `/api/health` as the platform liveness URL and document `/api/ready` for a
post-deploy configuration check.

- [ ] **Step 4: Run the contract and full verification gate**

Run:

```bash
npm test -- src/config/verification.test.ts
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foundation_verify_test \
DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/foundation_verify_test \
ADMIN_USERNAME=review \
ADMIN_PASSWORD=review-password \
AUTH_SECRET=review-secret-review-secret-1234567890 \
ADMIN_TRUST_PROXY=false \
npm run verify
```

Expected: all unit tests, lint, typecheck, schema validation, production build,
and whitespace validation pass. The existing `next/image` warning may remain
non-blocking only if ESLint exits zero. These database URLs are inert validation
placeholders: `prisma validate` parses the schema and environment without
connecting to or modifying a database.

- [ ] **Step 5: Commit the verification gate**

```bash
git add package.json README.md src/config/verification.test.ts
git commit -m "chore: add admin release verification gate"
```

## Task 7: Perform browser and final regression verification

**Files:**
- Modify only if a verified defect requires a focused fix and test.

- [ ] **Step 1: Start the production-like local server**

Run:

```bash
ADMIN_USERNAME=review \
ADMIN_PASSWORD=review-password \
AUTH_SECRET=review-secret-review-secret-1234567890 \
ADMIN_TRUST_PROXY=false \
npm run build

ADMIN_USERNAME=review \
ADMIN_PASSWORD=review-password \
AUTH_SECRET=review-secret-review-secret-1234567890 \
ADMIN_TRUST_PROXY=false \
npm start
```

- [ ] **Step 2: Verify endpoints and production headers**

Run focused `curl` checks against the chosen local port:

- `/api/health` returns `200`/`{"ok":true}`;
- `/api/ready` returns `200` with valid runtime variables;
- a server started without valid admin variables keeps `/api/health` at `200`
  and returns `503`/`{"ok":false}` for `/api/ready`;
- `/admin/login` includes CSP, frame, permissions, privacy, and HSTS headers in
  the production build.

- [ ] **Step 3: Verify desktop UI at 1440 by 900**

Check login, overview, and `/admin/projects/new`. Confirm inputs, text areas, and
selects have visible boundaries; keyboard focus is visible; the skip link appears
on focus and moves focus past the header; upload success/failure feedback does
not erase a typed URL.

- [ ] **Step 4: Verify mobile UI at 390 by 844**

Check login, overview, and `/admin/projects/new` at the mobile viewport. Confirm
form controls remain legible, focus is visible, and no content is hidden behind
the sticky header. Then open `/admin/donations` directly and confirm the
`Пожертвования` tab is centered in the horizontal navigation. Scroll the strip
horizontally and verify both edge gradients remain pinned, the header remains
usable, and controls do not overflow.

- [ ] **Step 5: Stop the exact local server and rerun the gate**

Stop only the session created in Step 1, then run:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foundation_verify_test \
DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/foundation_verify_test \
ADMIN_USERNAME=review \
ADMIN_PASSWORD=review-password \
AUTH_SECRET=review-secret-review-secret-1234567890 \
ADMIN_TRUST_PROXY=false \
npm run verify
git status --short
```

Expected: verification passes and status contains only intentional release files.

- [ ] **Step 6: Commit any browser-driven correction**

If no correction was required, do not create an empty commit. Otherwise, add the
focused regression test and fix, rerun `npm run verify`, and commit with a message
describing the verified defect.


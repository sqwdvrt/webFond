# Stage 3 Admin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Зафиксировать начальную Prisma-миграцию и добавить безопасный вход в `/admin` для одной учетной записи из серверного окружения.

**Architecture:** Чистые модули `src/lib/admin-auth` отвечают за конфигурацию, постоянновременное сравнение, rate limiting и HMAC-сессию; тонкие Next.js Server Actions работают с асинхронными `headers()`/`cookies()` и перенаправлениями. `/admin/login` остается вне защищенной route group, а `/admin/(protected)` проверяет сессию серверным layout. Админский контент намеренно остается внутри существующего корневого header/footer в этом срезе, но не использует публичные hero, CTA или маркетинговые компоненты. Стили изолированы CSS module и не затрагивают текущие пользовательские изменения публичного сайта.

**Tech Stack:** Next.js 16 App Router, React 19 Server Actions, TypeScript 6, Node `crypto`, Prisma 6/PostgreSQL, Vitest 4, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-23-stage-3-admin-foundation-design.md`

**Primary references:** [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [Next.js cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), [Next.js redirects](https://nextjs.org/docs/app/guides/redirecting), [Prisma migrate diff](https://docs.prisma.io/docs/cli/migrate/diff).

---

## File Map

- `prisma/schema.prisma`: удалить неиспользуемые `AdminRole` и `AdminUser`.
- `prisma/migrations/20260823000000_initial/migration.sql`: начальная PostgreSQL-миграция, сгенерированная из схемы.
- `prisma/migrations/migration_lock.toml`: зафиксировать provider миграций.
- `src/db/schema.test.ts`: контракт схемы и начальной миграции.
- `src/lib/admin-auth/config.ts`: проверка `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_SECRET`.
- `src/lib/admin-auth/credentials.ts`: HMAC-сравнение логина и пароля.
- `src/lib/admin-auth/rate-limit.ts`: ограниченный in-memory счетчик попыток.
- `src/lib/admin-auth/client-key.ts`: нормализация и HMAC-отпечаток клиентского адреса.
- `src/lib/admin-auth/session-token.ts`: создание и проверка подписанного токена.
- `src/lib/admin-auth/session.ts`: адаптер Next.js cookie и серверные guards.
- `src/app/admin/login/actions.ts`: Server Action входа.
- `src/app/admin/login/login-form.tsx`: интерактивная доступная форма.
- `src/app/admin/login/page.tsx`: страница входа и redirect активной сессии.
- `src/app/admin/(protected)/layout.tsx`: серверная защита закрытых страниц.
- `src/app/admin/(protected)/page.tsx`: минимальный экран администратора.
- `src/app/admin/(protected)/actions.ts`: выход из сессии.
- `src/app/admin/layout.tsx`: noindex metadata и общий admin-контейнер.
- `src/app/admin/admin.module.css`: изолированный responsive-интерфейс.
- `.env.example`: документировать admin-переменные без рабочего пароля.
- `.env`: локально установить выбранные учетные данные и случайный секрет; файл не коммитить.
- `README.md`: команды миграций и локального запуска админки.

Не изменять и не добавлять в коммиты существующие пользовательские правки в
`PROJECT_PLAN.md`, `WORK_REPORT.md`, документах списка деятельности и файлах
публичной части, показанных исходным `git status --short`.

---

### Task 0: Local Environment Prerequisites

**Files:**
- Create locally, never commit: `.env`

- [ ] **Step 1: Create the ignored local environment before Prisma checks**

Confirm `.env` is absent or inspect only its variable names without printing
values. Preserve any existing entries. Generate a secret with
`openssl rand -hex 32` and create/update:

```dotenv
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
SITE_URL="http://localhost:3000"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/byt_dobru?schema=public"
ADMIN_USERNAME="<local-only username>"
ADMIN_PASSWORD="<local-only password>"
AUTH_SECRET="<64 random hex characters>"
ADMIN_TRUST_PROXY="false"
```

`DATABASE_URL` is needed for Prisma config validation; Tasks 1-5 do not connect
to that database. Confirm `git check-ignore .env` succeeds and `git status
--short` does not list the file.

---

### Task 1: Prisma Schema And Initial Migration

**Files:**
- Create: `src/db/schema.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260823000000_initial/migration.sql`
- Create: `prisma/migrations/migration_lock.toml`

- [ ] **Step 1: Write the failing schema contract test**

Create `src/db/schema.test.ts` using `readFileSync` and assert:

```ts
const requiredModels = [
  "Donation",
  "Project",
  "NewsPost",
  "Document",
  "SiteSetting",
  "ContactRequest",
];

it("keeps only the managed-content and operational models", () => {
  for (const model of requiredModels) {
    expect(schema).toContain(`model ${model} {`);
  }
  expect(schema).not.toContain("model AdminUser {");
  expect(schema).not.toContain("enum AdminRole {");
});

it("has an initial migration for every required model", () => {
  for (const model of requiredModels) {
    expect(migration).toContain(`CREATE TABLE \"${model}\"`);
  }
});
```

Read paths with `new URL("../../prisma/...", import.meta.url)` so the test is independent of the shell working directory. Use `existsSync()` and an empty migration string before the file exists, so RED is an assertion failure rather than an import-time file error.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/db/schema.test.ts`

Expected: FAIL because `AdminUser`/`AdminRole` still exist and the migration file is absent.

- [ ] **Step 3: Remove the unused admin table contract**

Delete only `enum AdminRole` and `model AdminUser` from `prisma/schema.prisma`. Keep all other models, fields, indexes and enum values unchanged.

- [ ] **Step 4: Generate the initial migration without a database**

Run:

```bash
mkdir -p prisma/migrations/20260823000000_initial
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/20260823000000_initial/migration.sql
```

Create `prisma/migrations/migration_lock.toml`:

```toml
# Please do not edit this file manually
# It should be added in your version-control system (i.e. Git)
provider = "postgresql"
```

- [ ] **Step 5: Verify GREEN and migration determinism**

Run:

```bash
npm test -- src/db/schema.test.ts
npm run db:validate
npm run db:generate
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output /tmp/byt-dobru-initial.sql
diff -u prisma/migrations/20260823000000_initial/migration.sql /tmp/byt-dobru-initial.sql
```

Expected: all commands PASS and `diff` prints nothing.

If an explicitly disposable PostgreSQL URL is available as
`TEST_DATABASE_URL`, apply the migration there with `prisma migrate deploy`
using a temporary Prisma environment. Never point this check at a shared or
production database.

```bash
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

- [ ] **Step 6: Commit the schema slice**

```bash
git add prisma/schema.prisma prisma/migrations src/db/schema.test.ts
git commit -m "feat: add initial content schema migration"
```

---

### Task 2: Server-Only Admin Configuration

**Files:**
- Create: `src/lib/admin-auth/config.test.ts`
- Create: `src/lib/admin-auth/config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing configuration tests**

Cover a valid object and each missing/invalid value. The public API is:

```ts
export type AdminAuthConfig = {
  username: string;
  password: string;
  secret: string;
  trustProxy: boolean;
};

export class AdminAuthConfigurationError extends Error {}

export function readAdminAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AdminAuthConfig;
```

Tests must verify that `ADMIN_USERNAME` and `ADMIN_PASSWORD` are non-empty,
`AUTH_SECRET` has at least 32 characters, whitespace-only values are rejected,
`ADMIN_TRUST_PROXY` is exactly `"true"` or `"false"`, and thrown messages name
only the invalid variable, never its value.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/lib/admin-auth/config.test.ts`

Expected: FAIL because `config.ts` does not exist.

- [ ] **Step 3: Implement minimal lazy configuration validation**

Implement `readAdminAuthConfig()` without evaluating environment variables at
module import time. Trim the username and secret; preserve the password exactly
after checking `password.trim().length > 0`. This keeps `next build` independent
from admin secrets until an auth request is handled.

Update `.env.example`:

```dotenv
AUTH_SECRET=""
ADMIN_USERNAME=""
ADMIN_PASSWORD=""
ADMIN_TRUST_PROXY="false"
```

Remove `ADMIN_EMAIL`, which is no longer part of the design.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/admin-auth/config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the configuration slice**

```bash
git add .env.example src/lib/admin-auth/config.ts src/lib/admin-auth/config.test.ts
git commit -m "feat: validate admin auth configuration"
```

---

### Task 3: Credential Checking And Rate Limiting

**Files:**
- Create: `src/lib/admin-auth/credentials.test.ts`
- Create: `src/lib/admin-auth/credentials.ts`
- Create: `src/lib/admin-auth/rate-limit.test.ts`
- Create: `src/lib/admin-auth/rate-limit.ts`
- Create: `src/lib/admin-auth/client-key.test.ts`
- Create: `src/lib/admin-auth/client-key.ts`

- [ ] **Step 1: Write the failing rate limiter tests**

Define this API:

```ts
export type LoginLimitResult = { allowed: true } | { allowed: false };

export class LoginAttemptLimiter {
  constructor(options?: {
    maxAttempts?: number;
    windowMs?: number;
    blockMs?: number;
    maxEntries?: number;
  });
  check(key: string, now: number): LoginLimitResult;
  recordFailure(key: string, now: number): void;
  recordSuccess(key: string): void;
}
```

Test five failures in 15 minutes, a 15-minute block, expiry, successful reset,
independent keys and bounded eviction when `maxEntries` is reached.

- [ ] **Step 2: Run limiter tests and verify RED**

Run: `npm test -- src/lib/admin-auth/rate-limit.test.ts`

Expected: FAIL because `rate-limit.ts` does not exist.

- [ ] **Step 3: Implement the minimal bounded limiter and verify GREEN**

Use one `Map<string, AttemptState>`. Remove expired entries before inserting;
when full, remove the oldest entry. Do not add timers.

Run: `npm test -- src/lib/admin-auth/rate-limit.test.ts`

Expected: PASS.

- [ ] **Step 4: Write failing credential and client-key tests**

Credential API:

```ts
export function credentialsMatch(input: {
  username: string;
  password: string;
  config: AdminAuthConfig;
}): boolean;
```

Client-key API:

```ts
type HeaderReader = { get(name: string): string | null };

export function createClientKey(input: {
  headers: HeaderReader;
  secret: string;
  trustProxy: boolean;
  environment: string | undefined;
}): string;
```

Test correct and incorrect credentials, differing lengths, stable fingerprints,
first `x-forwarded-for` value only when `trustProxy` is true, `x-real-ip`
fallback, a fixed `local` source outside production, and a shared `unknown`
production source when proxy trust is false or no trusted header exists. Assert
the returned key never contains the raw IP. The deployment
must set `ADMIN_TRUST_PROXY=true` only when its reverse proxy overwrites incoming
forwarding headers rather than appending untrusted client values.

- [ ] **Step 5: Run the new tests and verify RED**

Run: `npm test -- src/lib/admin-auth/credentials.test.ts src/lib/admin-auth/client-key.test.ts`

Expected: FAIL because both modules are absent.

- [ ] **Step 6: Implement fixed-length HMAC comparison and client fingerprinting**

Use Node `createHmac("sha256", config.secret)` for both submitted and configured
credential values, then `timingSafeEqual()` on the fixed 32-byte digests. Compute
the client key with HMAC-SHA-256 over the normalized source and return a hex
digest. Never retain or log the raw address.

- [ ] **Step 7: Verify GREEN**

Run: `npm test -- src/lib/admin-auth/credentials.test.ts src/lib/admin-auth/rate-limit.test.ts src/lib/admin-auth/client-key.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the authentication core**

```bash
git add src/lib/admin-auth/credentials* src/lib/admin-auth/rate-limit* src/lib/admin-auth/client-key*
git commit -m "feat: secure admin credential checks"
```

---

### Task 4: Signed Session Token And Cookie Adapter

**Files:**
- Create: `src/lib/admin-auth/session-token.test.ts`
- Create: `src/lib/admin-auth/session-token.ts`
- Create: `src/lib/admin-auth/session.test.ts`
- Create: `src/lib/admin-auth/session.ts`

- [ ] **Step 1: Write failing token tests**

Define:

```ts
export type AdminSessionPayload = {
  version: 1;
  username: string;
  issuedAt: number;
  expiresAt: number;
};

export function createSessionToken(input: {
  username: string;
  secret: string;
  now: number;
}): { token: string; payload: AdminSessionPayload };

export function verifySessionToken(input: {
  token: string;
  username: string;
  secret: string;
  now: number;
}): AdminSessionPayload | null;
```

Test an 8-hour lifetime, valid verification, payload tampering, signature
tampering, truncated and oversized signatures, wrong secret, wrong current
username, expiry, malformed Base64/JSON, wrong version and extra token segments.

- [ ] **Step 2: Run token tests and verify RED**

Run: `npm test -- src/lib/admin-auth/session-token.test.ts`

Expected: FAIL because `session-token.ts` does not exist.

- [ ] **Step 3: Implement the minimal signed token**

Serialize JSON to Base64URL, append a Base64URL HMAC-SHA-256 signature separated
by one dot. Check both decoded signature lengths before calling
`timingSafeEqual`, then compare them. Parse and
validate every payload field before returning it. Use seconds consistently.

- [ ] **Step 4: Verify token GREEN**

Run: `npm test -- src/lib/admin-auth/session-token.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing cookie adapter tests**

Test through an injected cookie-store interface so Vitest does not mock Next.js
internals. Required exported functions:

```ts
export const ADMIN_SESSION_COOKIE = "byt_dobru_admin_session";
export async function getAdminSession(): Promise<AdminSessionPayload | null>;
export async function setAdminSession(username: string): Promise<void>;
export async function clearAdminSession(): Promise<void>;
export async function requireAdminSession(): Promise<AdminSessionPayload>;
```

Keep small internal helpers exported under a `sessionTesting` object for tests:
read/set/delete against a passed store and explicit config/time. Assert cookie
attributes: `httpOnly`, `sameSite: "lax"`, `path: "/"`, eight-hour `maxAge`, and
`secure` only for production.

- [ ] **Step 6: Run cookie tests and verify RED**

Run: `npm test -- src/lib/admin-auth/session.test.ts`

Expected: FAIL because `session.ts` is absent.

- [ ] **Step 7: Implement the Next.js cookie adapter**

Use `await cookies()` from `next/headers`. `getAdminSession()` catches only
`AdminAuthConfigurationError` and returns `null`; it must not hide programming
errors. `requireAdminSession()` calls `redirect("/admin/login")` on a missing or
invalid session. Cookie mutation happens only in Server Actions.

- [ ] **Step 8: Verify session GREEN and commit**

Run: `npm test -- src/lib/admin-auth/session-token.test.ts src/lib/admin-auth/session.test.ts`

Expected: PASS.

```bash
git add src/lib/admin-auth/session-token* src/lib/admin-auth/session*
git commit -m "feat: add signed admin sessions"
```

---

### Task 5: Login, Protected Dashboard, And Logout

**Files:**
- Create: `src/app/admin/auth-flow.test.tsx`
- Create: `src/app/admin/admin-accessibility.test.tsx`
- Create: `src/app/admin/admin.module.css`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/login/actions.ts`
- Create: `src/app/admin/login/login-form.tsx`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/(protected)/actions.ts`
- Create: `src/app/admin/(protected)/layout.tsx`
- Create: `src/app/admin/(protected)/page.tsx`

- [ ] **Step 1: Write failing auth-flow and accessibility tests**

Mock only framework boundaries (`next/headers`, `next/navigation`, cookie adapter)
and test the real application modules:

- guest opening protected layout redirects to `/admin/login`;
- valid session renders protected children;
- active session opening `/admin/login` redirects to `/admin`;
- empty form returns «Введите логин и пароль»;
- wrong credentials return «Неверный логин или пароль»;
- sixth blocked attempt returns «Вход временно недоступен. Попробуйте позже»;
- valid credentials set a session and redirect to `/admin`;
- logout clears the cookie and redirects to `/admin/login`;
- metadata for the admin tree is `{ index: false, follow: false }`.

In `admin-accessibility.test.tsx`, render the planned login form with a no-op
action, run `axe()` using the existing project pattern, and require no serious or
critical violations. Also require one `h1`, two named inputs and one named submit
button. Both test files are created before any admin UI production file.

Server Action state contract:

```ts
export type LoginActionState = {
  status: "idle" | "error";
  message: string;
};

export async function loginAction(
  previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState>;
```

Export an injected `performLogin()` helper from `actions.ts` for deterministic
tests; the public Server Action supplies `headers()`, environment, singleton
limiter, current time and cookie writer.

- [ ] **Step 2: Run flow tests and verify RED**

Run: `npm test -- src/app/admin/auth-flow.test.tsx src/app/admin/admin-accessibility.test.tsx`

Expected: FAIL because admin routes/actions and form do not exist.

- [ ] **Step 3: Implement Server Actions and route boundaries**

`loginAction` must:

1. Parse `username` and `password` as strings without logging form data.
2. Return the empty-field message before checking credentials.
3. Read validated configuration and map config errors to the temporary-unavailable message.
4. Compute the client key and check the limiter.
5. Perform both HMAC credential comparisons.
6. Record failure or clear attempts on success.
7. Set the session, then call `redirect("/admin")` outside `try/catch`.

`logoutAction` calls `clearAdminSession()` then `redirect("/admin/login")`.
The protected layout calls `requireAdminSession()`. The login page calls
`getAdminSession()` and redirects active sessions before rendering the form.

- [ ] **Step 4: Implement the accessible UI**

Use `useActionState(loginAction, { status: "idle", message: "" })` in the client
form. Include labels, `name`, `required`, `autoComplete="username"` and
`autoComplete="current-password"`. Render a stable error area with
`role="status"`, `aria-live="polite"`, and connect it through `aria-describedby`.
The submit button text is «Войти» and uses `useFormStatus()` for «Вход...».

The dashboard shows `Фонд «Быть Добру»`, `Административная часть`, the current
username, an honest note that content management will be added in the next
slice, and a logout button. Do not render fake navigation or inactive CRUD cards.

`admin.module.css` uses existing CSS variables, an unframed full-width admin
band, one login panel with `border-radius: 8px`, stable field/button heights,
visible focus states and a single-column mobile layout at 720px. Do not edit
`globals.css`.

- [ ] **Step 5: Verify flow and accessibility GREEN**

Run: `npm test -- src/app/admin/auth-flow.test.tsx src/app/admin/admin-accessibility.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the admin UI slice**

```bash
git add src/app/admin
git commit -m "feat: protect admin dashboard login"
```

---

### Task 6: README And Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update project documentation**

In `README.md`, document required admin variables, `npx prisma migrate deploy`,
and local route `/admin/login` without publishing the local password.

- [ ] **Step 2: Run focused and complete verification**

Run in this exact order:

```bash
npm test
npm run lint
npm run typecheck
npm run db:validate
npm run db:generate
npm run build
git diff --check
```

Expected: every command exits 0. If any failure appears, invoke
`superpowers:systematic-debugging`, add a failing regression test where relevant,
and fix only the root cause.

- [ ] **Step 3: Verify in the browser**

Start `npm run dev` on a free local port. Using
`browser:control-in-app-browser`, verify at 1440 x 900 and 390 x 844:

- `/admin` redirects to `/admin/login`;
- wrong password shows the neutral error and does not navigate;
- корректные локальные учетные данные открывают `/admin`;
- reload preserves the session;
- logout returns to `/admin/login` and `/admin` is protected again;
- Tab order, focus, labels and mobile layout are coherent;
- no console errors, overlaps or horizontal overflow.

- [ ] **Step 4: Commit only owned documentation changes**

Before staging, inspect `git status --short` and `git diff`. Do not stage the
pre-existing public-site changes listed in the File Map.

```bash
git add README.md
git commit -m "docs: document admin foundation setup"
```

- [ ] **Step 5: Final branch verification**

Invoke `superpowers:verification-before-completion`, rerun the required checks,
then report exact passing commands, local URL, commits created and the remaining
Stage 3 scope. Do not claim the whole Stage 3 is complete.

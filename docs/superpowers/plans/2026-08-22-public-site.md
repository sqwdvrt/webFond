# Public Site Stage 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete responsive public site for Foundation "Byt Dobru" with three approved work directions, honest placeholders, accessible navigation, and complete SEO foundations.

**Architecture:** Keep approved public content in typed local modules and render it through small reusable server components. Route pages consume those modules directly now and can switch to Prisma-backed adapters in Stage 3. Interactive behavior remains limited to the existing mobile navigation; the SBP preview is explicitly non-interactive.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 with project CSS tokens, Vitest, Testing Library, axe-core.

---

### Task 1: Approved Content Model

**Files:**
- Create: `src/content/projects.ts`
- Create: `src/content/projects.test.ts`
- Modify: `src/config/site.ts`
- Modify: `src/config/site.test.ts`

- [ ] **Step 1: Write failing tests**

Test that exactly three approved projects exist with stable slugs, neutral status `Направление работы`, internal detail links, and no invented metrics. Test that `siteConfig` exposes a valid local site URL fallback and all public routes.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/content/projects.test.ts src/config/site.test.ts`

Expected: FAIL because the project module and extended config do not exist.

- [ ] **Step 3: Implement minimal typed content**

Create `ProjectContent` and export `projects`, `getProjectBySlug`, and `projectSlugs`. Use the exact project copy from the approved design spec. Extend the site config with `siteUrl`, `foundedAt`, and route constants without duplicating legal values.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/content/projects.test.ts src/config/site.test.ts`

- [ ] **Step 5: Commit**

Commit: `feat: add approved public content`

### Task 2: Shared Public Components

**Files:**
- Create: `src/components/content/page-hero.tsx`
- Create: `src/components/content/section-heading.tsx`
- Create: `src/components/content/project-card.tsx`
- Create: `src/components/content/empty-state.tsx`
- Create: `src/components/content/public-components.test.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/layout/site-header.tsx`
- Modify: `src/components/layout/site-header.test.tsx`

- [ ] **Step 1: Write failing component tests**

Render each component and assert semantic heading levels, internal project links, visible status text, and meaningful empty-state copy.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/components/content/public-components.test.tsx`

- [ ] **Step 3: Implement focused server components**

Keep each component data-driven and free of route-specific copy. Use Lucide icons only as decorative visuals with `aria-hidden`.

- [ ] **Step 4: Add stable responsive styles**

Add section bands, page hero, project grid, project card, empty state, and action group styles. Keep card radius at 8 px or less and avoid nested cards.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm test -- src/components/content/public-components.test.tsx`

- [ ] **Step 6: Commit**

Commit: `feat: add public content components`

### Task 3: Balanced Homepage

**Files:**
- Create: `src/app/page.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing homepage tests**

Assert one `h1`, approved mission copy, exact hero links to `/help` and `/contacts#help-request`, three project links, confirmed foundation facts, and honest news/report placeholders.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/app/page.test.tsx`

- [ ] **Step 3: Implement the balanced page**

Build the selected C direction: compact first viewport, numbered sections, three projects, participation placeholders, confirmed facts, news/report states, and final contact CTA. Use `public/brand/logo.jpg` as the only photographic asset.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/app/page.test.tsx`

- [ ] **Step 5: Commit**

Commit: `feat: build balanced homepage`

### Task 4: Information and Trust Routes

**Files:**
- Create: `src/app/about/page.tsx`
- Create: `src/app/help/page.tsx`
- Create: `src/app/contacts/page.tsx`
- Create: `src/app/requisites/page.tsx`
- Create: `src/components/donation/donation-preview.tsx`
- Create: `src/components/donation/donation-preview.test.tsx`
- Create: `src/app/information-pages.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing route and donation preview tests**

Assert approved about copy, confirmed legal details, neutral contact language, no contact form, disabled SBP fieldset, required amount presets, no name/email/consent fields, and no submit action.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/app/information-pages.test.tsx src/components/donation/donation-preview.test.tsx`

- [ ] **Step 3: Implement routes and preview**

Use server components. Keep the donation preview non-interactive and label its unavailable state. Use only internal links and the confirmed mailto address.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/app/information-pages.test.tsx src/components/donation/donation-preview.test.tsx`

- [ ] **Step 5: Commit**

Commit: `feat: add public information routes`

### Task 5: Projects and Honest Empty States

**Files:**
- Create: `src/app/projects/page.tsx`
- Create: `src/app/projects/[slug]/page.tsx`
- Create: `src/app/not-found.tsx`
- Create: `src/app/projects/projects-pages.test.tsx`
- Create: `src/app/news/page.tsx`
- Create: `src/app/reports/page.tsx`
- Create: `src/app/placeholder-pages.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing project and placeholder tests**

Assert three projects render, `generateStaticParams` returns three slugs, valid slugs resolve approved content, project contact links point to `/contacts#help-request`, invalid data lookup is absent, and news/reports use exact empty-state text. Assert the custom not-found page is noindex and links back to `/projects`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/app/projects/projects-pages.test.tsx src/app/placeholder-pages.test.tsx`

- [ ] **Step 3: Implement routes**

Render list and detail pages from `src/content/projects.ts`; call `notFound()` for an unknown slug. Add a custom noindex not-found page with a recovery link to `/projects`. Give placeholder pages `noindex, follow` metadata. Verify the unknown route returns HTTP 404 during browser QA.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/app/projects/projects-pages.test.tsx src/app/placeholder-pages.test.tsx`

- [ ] **Step 5: Commit**

Commit: `feat: add projects and placeholder routes`

### Task 6: Legal Placeholders and Footer Completion

**Files:**
- Create: `src/components/legal/legal-placeholder.tsx`
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/personal-data-consent/page.tsx`
- Create: `src/app/donation-offer/page.tsx`
- Create: `src/app/cookies/page.tsx`
- Create: `src/components/legal/legal-placeholder.test.tsx`
- Modify: `src/components/layout/site-footer.tsx`
- Modify: `src/components/layout/site-footer.test.tsx`

- [ ] **Step 1: Write failing legal and footer tests**

Assert the legal disclaimer, `noindex` metadata, cookies link, requisites link, and confirmed legal identifiers.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/components/legal/legal-placeholder.test.tsx src/components/layout/site-footer.test.tsx`

- [ ] **Step 3: Implement placeholders and footer links**

Use one reusable legal component and route-specific titles. Do not add policy clauses.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/components/legal/legal-placeholder.test.tsx src/components/layout/site-footer.test.tsx`

- [ ] **Step 5: Commit**

Commit: `feat: add legal publishing placeholders`

### Task 7: Metadata, Sitemap, Robots, and Structured Data

**Files:**
- Create: `src/components/seo/organization-json-ld.tsx`
- Create: `src/components/seo/organization-json-ld.test.tsx`
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`
- Create: `src/app/seo-routes.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: all indexable route `page.tsx` files
- Modify: `.env.example`

- [ ] **Step 1: Write failing SEO tests**

Assert metadataBase, unique title, description, and canonical URL for every indexable route, project `generateMetadata`, Open Graph image, sitemap inclusion/exclusion, robots exclusions, and exact Schema.org mappings for INN, OGRN, and KPP.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/components/seo/organization-json-ld.test.tsx src/app/seo-routes.test.ts`

- [ ] **Step 3: Implement SEO foundation**

Read the site origin from `NEXT_PUBLIC_SITE_URL` with localhost fallback. Add unique static metadata to each indexable page and `generateMetadata` for project pages. Render one `NGO` JSON-LD block in the root layout. Exclude placeholder routes from sitemap.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/components/seo/organization-json-ld.test.tsx src/app/seo-routes.test.ts`

- [ ] **Step 5: Commit**

Commit: `feat: add public site seo foundation`

### Task 8: Accessibility, Browser QA, and Documentation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/accessibility.test.tsx`
- Create: `src/content/content-integrity.test.ts`
- Modify: `src/app/globals.css`
- Modify: `PROJECT_PLAN.md`
- Modify: `WORK_REPORT.md`
- Modify: `README.md`

- [ ] **Step 1: Add axe-core and write failing accessibility tests**

Test header, footer, homepage, project card, and donation preview for serious or critical axe violations. Add semantic assertions for heading order and menu state. Add an Escape-key test for the mobile menu. Scan public source and content for the long dash character and scan approved data for unconfirmed numeric claims.

- [ ] **Step 2: Run tests and verify RED if violations exist**

Run: `npm test -- src/components/accessibility.test.tsx`

- [ ] **Step 3: Fix only observed accessibility issues**

Do not change approved copy or scope while fixing semantics and styles.

- [ ] **Step 4: Run the full quality suite**

Run: `npm test && npm run lint && npm run typecheck && npm run build && npm audit --audit-level=high`

- [ ] **Step 5: Run browser QA**

Check all public routes at 1440 x 900 and 390 x 844. Verify navigation, exact internal CTA targets, HTTP 404 recovery, no overflow, no console errors, and meaningful first viewport content. Run keyboard checks with Tab, Shift+Tab, Enter, and Escape.

- [ ] **Step 6: Update the two project documents**

Mark Stage 2 complete in `PROJECT_PLAN.md`. Add a short, factual Stage 2 section to `WORK_REPORT.md`. Document local run and content limitations in `README.md`.

- [ ] **Step 7: Commit**

Commit: `docs: complete public site stage`

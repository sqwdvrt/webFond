# Homepage Activity List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace activity cards on the homepage and `/projects` with an accessible, compact list of eight charter-faithful summaries.

**Architecture:** Keep each exact charter description and its public summary together in `src/content/projects.ts`. Render the summaries directly as a semantic list on the homepage and `/projects`, then remove the unused `ProjectCard` component and styles.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS, Vitest, Testing Library.

---

### Task 1: Add charter-faithful homepage summaries

**Files:**
- Modify: `src/content/projects.test.ts`
- Modify: `src/content/projects.ts`

- [ ] **Step 1: Write the failing content test**

Extend `src/content/projects.test.ts` with an assertion for the exact ordered summaries:

```ts
expect(projects.map((activity) => activity.homepageDescription)).toEqual([
  "Помощь социально незащищенным гражданам, оказавшимся в тяжелом материальном положении.",
  "Поддержка пожилых людей, детей-сирот, детей и престарелых граждан, находящихся на попечении государства, малообеспеченных и других людей, нуждающихся в помощи.",
  "Восстановление, облагораживание и охрана исторически, культурно и природоохранно значимых объектов и территорий.",
  "Объединение усилий организаций для помощи нуждающимся и развития меценатства.",
  "Проведение информационных и иных акций в помощь и поддержку нуждающихся.",
  "Привлечение добровольных пожертвований и денежных взносов российских организаций и граждан.",
  "Участие в государственных программах, получение и реализация грантов.",
  "Разработка и реализация проектов финансирования социальной сферы с участием бизнеса, бюджета и физических лиц.",
]);
```

- [ ] **Step 2: Run the content test and verify RED**

Run: `npm test -- src/content/projects.test.ts`

Expected: FAIL because `homepageDescription` does not exist.

- [ ] **Step 3: Add the summaries to the content model**

Add `homepageDescription: string` to `ProjectContent` and add the approved summary beside every exact `description`. Do not change `description`.

- [ ] **Step 4: Run the content test and verify GREEN**

Run: `npm test -- src/content/projects.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the content change**

```bash
git add src/content/projects.ts src/content/projects.test.ts
git commit -m "content: add homepage activity summaries"
```

### Task 2: Replace activity cards with the compact list

**Files:**
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/content/project-card.tsx`
- Modify: `src/components/content/public-components.test.tsx`
- Modify: `src/app/projects/page.tsx`
- Modify: `src/app/projects/projects-pages.test.tsx`

- [ ] **Step 1: Write the failing homepage test**

Update `src/app/page.test.tsx` to require:

```ts
expect(screen.getByText("Фонд помогает людям, которым особенно нужна поддержка, и объединяет необходимые для этого усилия и средства.")).toBeVisible();
expect(container.querySelector(".activity-list")).toBeInstanceOf(HTMLUListElement);
expect(container.querySelectorAll(".activity-list > li")).toHaveLength(8);
expect(Array.from(container.querySelectorAll(".activity-list > li")).map((item) => item.textContent)).toEqual(
  projects.map((project) => project.homepageDescription),
);
expect(container.querySelectorAll(".project-card-compact")).toHaveLength(0);
expect(container.querySelectorAll(".activity-list .project-number")).toHaveLength(0);
```

Keep the existing assertion that the section sequence begins with `01` and the disclaimer is visible.

- [ ] **Step 2: Run the homepage test and verify RED**

Run: `npm test -- src/app/page.test.tsx`

Expected: FAIL because `.activity-list` and the introductory sentence do not exist.

- [ ] **Step 3: Implement the semantic list**

In `src/app/page.tsx`:

- remove the `ProjectCard` import;
- retain `<SectionHeading number="01" ... />` but remove its disclaimer `intro`;
- render the approved introduction, `<ul className="activity-list">`, and eight `<li>` elements using `homepageDescription`;
- do not render the additional status label «Виды деятельности по уставу» on the homepage;
- do not render the disclaimer about future programs and projects on the homepage.

Use ordinary text elements only. Do not add a component, icon, number, link, or project-like label to any list item.

- [ ] **Step 4: Add the list styles**

In `src/app/globals.css`:

- add a constrained `.activity-intro`;
- add a two-column `.activity-list` with zero list styling and a top rule;
- give each `li` a bottom rule, stable padding, readable line height, and a decorative green `::before` stroke;
- switch `.activity-list` to one column in the existing mobile media query;
- preserve DOM order so the mobile sequence remains the charter sequence.

Remove `.project-section-status`, `.project-grid-compact`, and `.project-card-compact` rules after they become unused.

- [ ] **Step 5: Remove the unused compact card API**

Render the same introduction and semantic list on `/projects`. Remove the page-level status heading and disclaimer. Delete `ProjectCard`, its component test, the unused `status` content field, and all card-specific CSS after both public pages use the list.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/app/page.test.tsx src/content/projects.test.ts src/components/content/public-components.test.tsx src/app/projects/projects-pages.test.tsx
```

Expected: all focused tests PASS, including `/projects` regression coverage.

- [ ] **Step 7: Commit the presentation change**

```bash
git add src/app/page.tsx src/app/page.test.tsx src/app/globals.css src/components/content/project-card.tsx src/components/content/public-components.test.tsx
git commit -m "style: replace homepage activity cards with list"
```

### Task 3: Update project notes and verify the site

**Files:**
- Modify: `PROJECT_PLAN.md`
- Modify: `WORK_REPORT.md`

- [ ] **Step 1: Record the approved homepage presentation**

In `PROJECT_PLAN.md`, update the activity-section note to distinguish the exact `/projects` wording from the clear homepage summaries and record the no-card, two-column/one-column list layout.

In `WORK_REPORT.md`, add one concise bullet stating that homepage activity cards were replaced by the approved compact statutory list while `/projects` remained unchanged.

- [ ] **Step 2: Run the complete automated verification**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected: every command exits with status 0.

- [ ] **Step 3: Verify the rendered homepage**

At desktop and mobile viewports, verify:

- section `01` remains visible;
- eight unnumbered list items appear in charter order;
- desktop uses two columns and mobile uses one;
- no text overlaps or overflows;
- `/projects` still shows the existing full cards and exact wording;
- browser console contains no errors.

- [ ] **Step 4: Commit documentation and final adjustments**

```bash
git add PROJECT_PLAN.md WORK_REPORT.md
git commit -m "docs: record homepage activity list"
```

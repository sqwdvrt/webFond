# Compact Activities Cards Implementation Plan

> **Follow-up, 2026-08-23:** The card numbering described in the original implementation steps was removed at the user's request. Current compact cards have no internal number labels.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make homepage block 01 compact and readable while preserving all charter wording and leaving `/projects` unchanged.

**Architecture:** Add an opt-in compact presentation to `ProjectCard` and use it only from the homepage. The homepage renders the shared charter label once above a two-column grid, while the default card presentation remains intact for `/projects`.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Add an opt-in compact card presentation

**Files:**
- Modify: `src/components/content/public-components.test.tsx`
- Modify: `src/components/content/project-card.tsx`

- [ ] **Step 1: Write the failing component test**

Add a test that renders a compact card and verifies that it shows a padded number, keeps the charter wording, and omits the repeated status label:

```tsx
it("renders the compact charter activity with a number and no repeated status", () => {
  render(<ProjectCard project={projects[0]} compact number={1} />);
  expect(screen.getByText("01")).toHaveClass("project-number");
  expect(screen.getByText(/Помощь социально незащищенным гражданам/)).toBeVisible();
  expect(screen.queryByText("Виды деятельности по уставу")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `npm test -- src/components/content/public-components.test.tsx`

Expected: FAIL because `ProjectCard` does not accept `compact` or `number` and does not render `.project-number`.

- [ ] **Step 3: Implement the minimal compact variant**

Update `ProjectCard` so the existing default output is unchanged and the compact variant renders the number instead of the status:

```tsx
type ProjectCardProps = {
  project: ProjectContent;
  compact?: boolean;
  number?: number;
};

export function ProjectCard({ project, compact = false, number }: ProjectCardProps) {
  const className = compact ? "project-card project-card-compact" : "project-card";

  return (
    <article className={className}>
      {compact ? (
        <span className="project-number">{String(number).padStart(2, "0")}</span>
      ) : (
        <span className="project-status">{project.status}</span>
      )}
      <h3>{project.description}</h3>
    </article>
  );
}
```

- [ ] **Step 4: Run the component test and verify GREEN**

Run: `npm test -- src/components/content/public-components.test.tsx`

Expected: PASS.

### Task 2: Apply the compact presentation only to homepage block 01

**Files:**
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/projects/projects-pages.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing homepage and regression assertions**

In `src/app/page.test.tsx`, replace the expectation for eight repeated status labels with:

```tsx
expect(screen.getAllByText("Виды деятельности по уставу")).toHaveLength(1);
expect(Array.from(document.querySelectorAll(".project-number")).map((item) => item.textContent)).toEqual([
  "01", "02", "03", "04", "05", "06", "07", "08",
]);
expect(document.querySelectorAll(".project-card-compact")).toHaveLength(8);
```

In `src/app/projects/projects-pages.test.tsx`, assert that `/projects` still renders eight `.project-status` labels and no `.project-card-compact` elements.

Import `projects` from `@/content/projects` in both page tests and compare every project card heading with the unchanged content data:

```tsx
expect(Array.from(document.querySelectorAll(".project-card h3")).map((heading) => heading.textContent)).toEqual(
  projects.map((project) => project.description),
);
```

- [ ] **Step 2: Run the page tests and verify RED**

Run: `npm test -- src/app/page.test.tsx src/app/projects/projects-pages.test.tsx`

Expected: FAIL because the homepage still repeats the status and has no compact cards.

- [ ] **Step 3: Update homepage markup**

Render the status once and pass the compact card props only on the homepage:

```tsx
<span className="project-status project-section-status">Виды деятельности по уставу</span>
<div className="project-grid project-grid-compact">
  {projects.map((project, index) => (
    <ProjectCard key={project.description} project={project} compact number={index + 1} />
  ))}
</div>
```

- [ ] **Step 4: Add scoped compact styles**

Add styles that do not alter default project cards:

```css
.project-section-status { display: block; margin-bottom: 14px; }
.project-grid-compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.project-card-compact { min-height: 0; padding: 22px 24px; }
.project-number { color: var(--brand); font-size: 12px; font-weight: 700; }
.project-card-compact h3 {
  margin: 12px 0 0;
  font-family: inherit;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.5;
}
```

Inside the existing `@media (max-width: 720px)` block add:

```css
.project-grid-compact { grid-template-columns: 1fr; }
.project-card-compact { min-height: 0; padding: 20px; }
.project-card-compact h3 { font-size: 17px; }
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/components/content/public-components.test.tsx src/app/page.test.tsx src/app/projects/projects-pages.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected: all commands pass with no warnings or whitespace errors.

- [ ] **Step 7: Verify visually**

Use the existing server at `http://localhost:3001/`. If it is not running, start it with `npm run dev -- -p 3001`. Reload the page and verify block 01 at a desktop viewport and at a mobile viewport no wider than `720px`:

- desktop has two compact columns;
- mobile has one compact column;
- all eight descriptions are fully visible;
- no text overlaps or causes horizontal scrolling;
- `/projects` retains its prior presentation.

- [ ] **Step 8: Commit implementation**

```bash
git add src/components/content/project-card.tsx src/components/content/public-components.test.tsx src/app/page.tsx src/app/page.test.tsx src/app/projects/projects-pages.test.tsx src/app/globals.css
git commit -m "style: compact homepage activities"
```

# Fundraising Progress Meter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the fundraising progress block on project cards and project detail pages visually consistent with the existing site while preserving one shared calculation and component.

**Architecture:** Keep `FundraisingMeter` as the single presentation component and keep `fundraisingProgress` as the single source of truth for collected amount, goal, and capped percentage. Use a small variant prop only if card and detail layouts need different spacing or button treatment; do not duplicate fundraising markup or calculation. Update the existing site stylesheet and extend focused component/page tests.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS in `src/app/globals.css`, Vitest, Testing Library.

---

## Current state and scope

- `src/features/fundraising/progress.ts` already combines successful online donations with `manualRaisedKopecks` and caps the fill at 100%.
- `src/components/fundraising/fundraising-meter.tsx` already renders collected amount, goal, a native ARIA progress bar, and a help link.
- `src/app/projects/page.tsx` already renders the meter on cards when a project has a fundraising goal.
- `src/app/projects/[slug]/page.tsx` already renders the meter on the project detail page.
- `src/app/globals.css` already contains the initial meter styles.

The implementation should therefore focus on visual integration, responsive behavior, and regression coverage. Payment aggregation, donation persistence, and admin data entry are out of scope.

## Files to modify

- Modify: `src/components/fundraising/fundraising-meter.tsx` — keep the shared component, adding only the minimum variant/semantic hooks needed for card/detail styling.
- Modify: `src/components/fundraising/fundraising-meter.test.tsx` — cover the shared markup, displayed values, link, ARIA attributes, and any variant behavior.
- Modify: `src/app/globals.css` — align the meter with existing site tokens, card/detail spacing, typography, borders, radii, and responsive rules.
- Modify: `src/app/projects/projects-pages.test.tsx` — verify cards render the meter only when a goal exists and link to the correct project help flow.
- Modify: `src/app/projects/[slug]/project-detail.test.tsx` — verify the detail page renders the same fundraising data and help link.
- Inspect only: `src/features/fundraising/progress.ts`, `src/features/fundraising/progress.test.ts`, `src/app/projects/page.tsx`, `src/app/projects/[slug]/page.tsx` — change only if tests expose a real contract gap.

## Design and behavior decisions

1. Use the site’s existing `--brand`, `--brand-dark`, `--surface`, `--line`, and `--muted` tokens instead of copying the reference image’s colors.
2. Preserve the reference structure: collected amount on the left, goal on the right, progress track below, then the “Помочь” action.
3. Keep the meter full-width inside a card and constrain it naturally on the detail layout using existing content widths.
4. Keep the progress bar accessible with `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and a rounded numeric `aria-valuenow`.
5. Keep the visual fill capped at 100% even when collected donations exceed the goal.
6. Do not render a meter for projects with no positive goal; do not invent fallback fundraising numbers.
7. Avoid animation that makes the final state unclear or inaccessible; retain only a short width transition if it matches the site’s existing motion conventions.

## Task 1: Lock the component contract with tests

**Files:**
- Modify: `src/components/fundraising/fundraising-meter.test.tsx`

- [ ] **Step 1: Review the existing tests and identify missing assertions.**

  Confirm the test fixture covers a non-round percentage, formatted collected and goal amounts, the help URL, and the progressbar attributes.

- [ ] **Step 2: Add/adjust failing assertions for the intended contract.**

  Assert that:

  - both labels and both formatted amounts are present;
  - the progressbar exposes the rounded `aria-valuenow` and an accessible label;
  - the fill width matches the computed percentage;
  - the action links to the supplied help URL;
  - the component does not change the underlying calculation contract.

- [ ] **Step 3: Run the focused test.**

  Run: `npm test -- --run src/components/fundraising/fundraising-meter.test.tsx`

  Expected: existing behavior passes, or the new assertions fail only where the implementation needs the agreed presentation hook.

## Task 2: Refine the shared meter component

**Files:**
- Modify: `src/components/fundraising/fundraising-meter.tsx`

- [ ] **Step 1: Keep the component API minimal.**

  Preserve `progress` and `helpHref` as required inputs. Add a typed visual variant only if the card and detail layout need different styling; prefer a class modifier over duplicated JSX.

- [ ] **Step 2: Preserve semantic structure.**

  Keep the amount group, progressbar, and action link as separate semantic regions. Ensure the visible text and accessible label use the same formatted values.

- [ ] **Step 3: Make the fill style safe.**

  Pass only the already capped percentage to the inline width style. Do not add client-side donation fetching or duplicate percentage math.

- [ ] **Step 4: Run the component test.**

  Run: `npm test -- --run src/components/fundraising/fundraising-meter.test.tsx`

  Expected: PASS.

## Task 3: Apply the site visual system and responsive rules

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Inspect neighboring card, detail, button, and breakpoint styles.**

  Reuse existing spacing and color tokens; avoid adding a second design language for fundraising.

- [ ] **Step 2: Update meter presentation.**

  Align label sizes, amount typography, track height, fill color, border/radius treatment, and button spacing with the surrounding `.published-card`, `.published-detail`, and `.button-primary` rules.

- [ ] **Step 3: Add narrow-width safeguards.**

  Ensure long currency values do not overflow, amount columns can shrink or wrap cleanly, and the goal remains visually associated with “нужно” on mobile.

- [ ] **Step 4: Verify styling statically and in the test suite.**

  Run: `npm test -- --run src/components/fundraising/fundraising-meter.test.tsx src/app/projects/projects-pages.test.tsx src/app/projects/[slug]/project-detail.test.tsx`

  Expected: PASS.

## Task 4: Verify card and detail integration

**Files:**
- Modify: `src/app/projects/projects-pages.test.tsx`
- Modify: `src/app/projects/[slug]/project-detail.test.tsx`
- Inspect: `src/app/projects/page.tsx`
- Inspect: `src/app/projects/[slug]/page.tsx`

- [ ] **Step 1: Add card-level regression coverage.**

  Use a published project with a goal and assert that the rendered card includes the meter, collected/goal values, and `/help?project=<slug>` link.

- [ ] **Step 2: Add no-goal coverage.**

  Assert that a published project with no positive goal does not render a fundraising meter.

- [ ] **Step 3: Add detail-level regression coverage.**

  Assert that the project page renders the same progress values and project-specific help link as the card.

- [ ] **Step 4: Run the focused integration tests.**

  Run: `npm test -- --run src/app/projects/projects-pages.test.tsx src/app/projects/[slug]/project-detail.test.tsx`

  Expected: PASS.

## Task 5: Verify calculation edge cases remain intact

**Files:**
- Inspect: `src/features/fundraising/progress.ts`
- Modify only if required: `src/features/fundraising/progress.test.ts`

- [ ] **Step 1: Confirm existing tests cover missing/invalid goals.**

  Required cases: `null`, zero, and negative goals return `null`.

- [ ] **Step 2: Confirm existing tests cover amount aggregation.**

  Required case: online successful amount plus manual amount is displayed as collected.

- [ ] **Step 3: Confirm existing tests cover capping.**

  Required case: collected amount above goal produces `fillPercent === 100`.

- [ ] **Step 4: Add only missing tests and run them.**

  Run: `npm test -- --run src/features/fundraising/progress.test.ts`

  Expected: PASS.

## Task 6: Full verification and visual QA

**Files:**
- No additional source files expected.

- [ ] **Step 1: Run the full test suite.**

  Run: `npm test -- --run`

  Expected: PASS with no fundraising, accessibility, or page-render regressions.

- [ ] **Step 2: Run the project’s lint/type checks.**

  Run the repository scripts from `package.json` (expected commands are typically `npm run lint` and `npm run typecheck`; use the exact available names).

  Expected: no new diagnostics.

- [ ] **Step 3: Inspect the rendered `/projects` page.**

  Check a card with a goal, a card without a goal, a partially funded project, and an overfunded project. Confirm that the card remains readable at narrow width.

- [ ] **Step 4: Inspect a rendered `/projects/[slug]` page.**

  Confirm that detail-page spacing fits the existing layout, the button remains easy to tap, and the same values appear as on the card.

- [ ] **Step 5: Review the final diff.**

  Run: `git diff -- src/components/fundraising/fundraising-meter.tsx src/components/fundraising/fundraising-meter.test.tsx src/app/globals.css src/app/projects/projects-pages.test.tsx 'src/app/projects/[slug]/project-detail.test.tsx'`

  Expected: only focused component, style, and test changes; no payment or database schema changes.

## Completion criteria

- Every eligible project card and project detail page shows the same progress data.
- Projects without a positive goal show no meter.
- The visual style uses the site’s existing design tokens and remains readable on mobile.
- The bar exposes correct accessible progress semantics.
- Existing fundraising calculations and payment flows are unchanged.
- Focused tests, full tests, lint, and type checks pass.

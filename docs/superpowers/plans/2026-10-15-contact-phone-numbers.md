# Contact Phone Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show both fund phone numbers as dialable links in the «Как написать» card on `/contacts`.

**Architecture:** Keep contact information in the existing contacts page component. Extend only the third contact-details card with two semantic `tel:` anchors, leaving email, address, form, and other pages unchanged.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library.

---

### Task 1: Add dialable phone numbers to the contacts card

**Files:**
- Modify: `src/app/information-pages.test.tsx:148-157`
- Modify: `src/app/contacts/page.tsx:34-42`

- [ ] **Step 1: Write the failing test**

Add expectations to the existing contacts-page test for the two visible phone numbers and their exact links:

```tsx
expect(screen.getByText("Позвоните нам:")).toBeVisible();
expect(screen.getByRole("link", { name: "8 928 714 77 83" })).toHaveAttribute(
  "href",
  "tel:+79287147783",
);
expect(screen.getByRole("link", { name: "8 928 715 77 83" })).toHaveAttribute(
  "href",
  "tel:+79287157783",
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/information-pages.test.tsx`

Expected: FAIL because the phone-number links do not yet exist.

- [ ] **Step 3: Implement the minimal page change**

In the existing «Как написать» card, place the line «Позвоните нам:» and the two phone links between the heading and its explanatory paragraph. Render the visible values as `8 928 714 77 83` and `8 928 715 77 83`, targeting `tel:+79287147783` and `tel:+79287157783` respectively. Use no new component, configuration, or styling unless existing styles cannot accommodate the anchors.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/app/information-pages.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run relevant static verification**

Run: `npm run lint && npm run typecheck`

Expected: both commands exit successfully.

- [ ] **Step 6: Commit**

```bash
git add src/app/contacts/page.tsx src/app/information-pages.test.tsx
git commit -m "feat: add contact phone numbers"
```

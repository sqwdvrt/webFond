# SBP Copy And NSPK Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Заменить публичные тексты на `/help` и в банковском QR так, чтобы СБП называлась полностью, без оговорки «если включена», и без путаницы с переводом по реквизитам.

**Architecture:** Три точные строки в существующих компонентах. Платёжный API, кнопка, подвал, оферта и главная не меняются. Пояснение «это не СБП» живёт в общем `BankQrTransfer`, поэтому видно и на `/help`, и на `/requisites`.

**Tech Stack:** Next.js App Router, React Testing Library, Vitest.

**Design spec:** `docs/superpowers/specs/2026-09-03-sbp-copy-nspk-design.md`

**Commit policy:** Не создавать git-коммиты без отдельного явного запроса пользователя.

---

## File Structure

- Modify: `src/app/help/page.tsx` — блок доверия «ЮKassa».
- Modify: `src/components/donation/donation-form.tsx` — единственный `preview-note` под формой.
- Modify: `src/components/donation/bank-qr-transfer.tsx` — всегда видимое примечание.
- Test: `src/app/information-pages.test.tsx`
- Test: `src/components/donation/donation-form.test.tsx`
- Test: `src/components/donation/bank-qr-transfer.test.tsx`
- Test: `src/components/layout/site-footer.test.tsx`

@superpowers:test-driven-development

---

### Task 1: Help page YooKassa trust copy

**Files:**
- Test: `src/app/information-pages.test.tsx`
- Modify: `src/app/help/page.tsx`

- [x] **Step 1: Write the failing assertion**

In `renders the live donation form when payments are enabled` add:

```ts
expect(
  screen.getByText(
    "Оплата проходит на стороне ЮKassa. Доступны Система быстрых платежей (СБП) и банковская карта. Выберите способ на странице оплаты. Если выбран СБП, подтвердите платёж в приложении банка. QR-код СБП показывает ЮKassa после перехода, не на этой странице.",
  ),
).toBeVisible();
expect(
  screen.queryByText(/если они включены в магазине/),
).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "Оплатить онлайн" })).toBeEnabled();
expect(screen.getByText(/Пожертвование через ЮKassa/)).toBeVisible();
```

Keep the existing check that the hero still says «Пожертвование через ЮKassa».

- [x] **Step 2: Run the test and verify RED**

Run: `npm test -- src/app/information-pages.test.tsx`

Expected: FAIL because the trust paragraph still contains «Обычно доступны СБП и банковская карта, если они включены в магазине».

- [x] **Step 3: Replace the trust paragraph**

In `trustItems(true)` set:

```ts
{
  title: "ЮKassa",
  text: "Оплата проходит на стороне ЮKassa. Доступны Система быстрых платежей (СБП) и банковская карта. Выберите способ на странице оплаты. Если выбран СБП, подтвердите платёж в приложении банка. QR-код СБП показывает ЮKassa после перехода, не на этой странице.",
},
```

Do not change the hero, section intro, or disabled-payments copy.

- [x] **Step 4: Run the test and verify GREEN**

Run: `npm test -- src/app/information-pages.test.tsx`

Expected: PASS.

---

### Task 2: Donation form note

**Files:**
- Test: `src/components/donation/donation-form.test.tsx`
- Modify: `src/components/donation/donation-form.tsx`

- [x] **Step 1: Write the failing assertion**

Replace the loose `/Оплата проходит на стороне ЮKassa/` check in `places personal data consent before the amount and requires both consents` with:

```ts
expect(
  screen.getByText(
    "Оплата проходит на стороне ЮKassa. Можно выбрать Систему быстрых платежей (СБП) или банковскую карту. При СБП подтвердите платёж в приложении банка. Пожертвование разовое, без подписки и автоматических списаний.",
  ),
).toBeVisible();
expect(screen.getByRole("button", { name: "Оплатить онлайн" })).toBeVisible();
```

- [x] **Step 2: Run the test and verify RED**

Run: `npm test -- src/components/donation/donation-form.test.tsx`

Expected: FAIL because the current note does not mention СБП.

- [x] **Step 3: Replace the existing `preview-note`**

One paragraph only, exact spec text. Do not add a second note.

- [x] **Step 4: Run the test and verify GREEN**

Run: `npm test -- src/components/donation/donation-form.test.tsx`

Expected: PASS.

---

### Task 3: Bank QR is not SBP

**Files:**
- Test: `src/components/donation/bank-qr-transfer.test.tsx`
- Test: `src/app/information-pages.test.tsx`
- Modify: `src/components/donation/bank-qr-transfer.tsx`

- [x] **Step 1: Write the failing assertions**

In `BankQrTransfer` first test (no bank selected) add:

```ts
expect(
  screen.getByText(
    "Это перевод по реквизитам фонда, не оплата через Систему быстрых платежей (СБП).",
  ),
).toBeVisible();
```

In information-pages:

- live help form test: same text is visible;
- published requisites test: same text is visible;
- fallback/error requisites tests: the text is absent (QR is hidden).

- [x] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/components/donation/bank-qr-transfer.test.tsx src/app/information-pages.test.tsx`

Expected: FAIL because the disclaimer is missing.

- [x] **Step 3: Add the always-visible note**

Place it with the other `preview-note` paragraphs in `BankQrTransfer`, outside the selected-bank branch.

- [x] **Step 4: Run the tests and verify GREEN**

Run: `npm test -- src/components/donation/bank-qr-transfer.test.tsx src/app/information-pages.test.tsx`

Expected: PASS.

---

### Task 4: Footer has no payment logos

**Files:**
- Test: `src/components/layout/site-footer.test.tsx`

- [x] **Step 1: Add a regression assertion**

```ts
it("does not show payment method logos", () => {
  const { container } = render(<SiteFooter />);
  expect(container.querySelectorAll("img")).toHaveLength(0);
  expect(container.textContent).not.toMatch(/СБП|Мир|Visa|Mastercard/i);
});
```

- [x] **Step 2: Run the test**

Run: `npm test -- src/components/layout/site-footer.test.tsx`

Expected: PASS without production changes. If it fails, stop — the footer already has a payment mark and the spec must be revisited.

---

### Task 5: Verify the cluster

- [x] **Step 1: Run the affected tests together**

Run: `npm test -- src/app/information-pages.test.tsx src/components/donation/donation-form.test.tsx src/components/donation/bank-qr-transfer.test.tsx src/components/layout/site-footer.test.tsx src/app/page.test.tsx`

Expected: PASS. Homepage tests still match the unchanged copy.

- [x] **Step 2: Browser check if a local app is available**

On `/help` with payments enabled: trust block, form note, bank QR disclaimer. On `/requisites` with published requisites: the same QR disclaimer. Do not require a live YooKassa payment.

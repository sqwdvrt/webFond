import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { test, expect } from "@playwright/test";
import { bankQrOptions, formatBankQrCopy } from "../../src/content/bank-qr";
import { donationOfferPublication } from "../../src/content/donation-offer";
import { personalDataConsentPublication } from "../../src/content/legal";

// Config validates this URL before tests are loaded. Never fall back to DATABASE_URL.
const prisma = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL! });
test.afterAll(async () => { await prisma.$disconnect(); });

test.beforeEach(async ({ context }) => {
  // Keep every browser request local, including accidental provider navigation.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && ['3017', '3018'].includes(url.port)) await route.continue();
    else await route.abort('blockedbyclient');
  });
});

test('home navigation and responsive menu', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if (info.project.name === 'mobile') {
    const opener = page.getByRole('button', { name: 'Открыть меню' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Меню сайта' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Закрыть меню' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await opener.click();
    await dialog.getByRole('link', { name: 'Помочь', exact: true }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(dialog).not.toBeVisible();
    await opener.click();
    await dialog.getByRole('link', { name: 'Нужна помощь', exact: true }).click();
  } else {
    await page.locator('header').getByRole('link', { name: 'Помочь', exact: true }).click();
    await expect(page).toHaveURL(/\/help$/);
    await page.getByRole('navigation', { name: 'Основная', exact: true }).getByRole('link', { name: 'Нужна помощь' }).click();
  }
  await expect(page).toHaveURL(/\/need-help$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('FAQ expands and collapses; public pages fit viewport', async ({ page }) => {
  for (const path of ['/', '/about', '/projects', '/help', '/need-help', '/contacts', '/requisites', '/news', '/reports', '/privacy', '/personal-data-consent', '/donation-offer', '/cookies']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `overflow at ${path}`).toBe(true);
  }
  await page.goto('/help');
  const entry = page.locator('.faq-list details').first();
  await entry.locator('summary').click();
  await expect(entry).toHaveAttribute('open', '');
  await expect(entry.locator('p')).toBeVisible();
  await entry.locator('summary').click();
  await expect(entry).not.toHaveAttribute('open');
});

test('bank choices expose matching QR, copy and requisites', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/help');
  const section = page.locator('.bank-qr-transfer');
  for (const bank of bankQrOptions) {
    await page.getByRole('group', { name: 'Банковский счёт фонда' }).getByRole('radio', { name: bank.label, exact: true }).check();
    await expect(section.getByRole('img', { name: bank.alt })).toHaveAttribute('src', bank.src);
    const download = section.getByRole('link', { name: 'Сохранить QR', exact: true });
    await expect(download).toHaveAttribute('href', bank.src);
    await expect(download).toHaveAttribute('download', `qr-${bank.id}.png`);
    expect((await page.request.get(bank.src)).ok()).toBe(true);
    await section.getByRole('button', { name: `Скопировать реквизиты ${bank.label}`, exact: true }).click();
    await expect(section.getByRole('button', { name: 'Скопировано' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(formatBankQrCopy(bank));
  }
  const link = section.locator('a[href*="requisites"]');
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(page).toHaveURL(/\/requisites(?:#.*)?$/);
});

test('document contents navigate to readable sections', async ({ page }) => {
  for (const path of ['/privacy', '/personal-data-consent', '/donation-offer', '/cookies']) {
    await page.goto(path);
    const contents = page.getByRole('navigation', { name: 'Содержание документа' });
    await contents.locator('summary').click();
    const target = contents.getByRole('link').last();
    const title = await target.innerText();
    await target.click();
    const heading = page.getByRole('heading', { level: 2, name: title, exact: true });
    await expect(heading).toBeFocused();
    const box = await heading.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(72);
    expect(box!.y).toBeLessThan(500);
  }
});

test('help jumps to bank transfer without passing through the payment form', async ({ page }) => {
  await page.goto('/help');
  await page.getByRole('navigation', { name: 'Способы помощи' }).getByRole('link', { name: 'Перевести по реквизитам' }).click();
  await expect(page).toHaveURL(/#bank-transfer$/);
  await expect(page.getByRole('heading', { name: 'Перевод в приложении банка', exact: true })).toBeInViewport();
});

test('guest admin redirect and missing page', async ({ page }) => {
  await page.goto('/admin/messages');
  await expect(page).toHaveURL(/\/admin\/login/);
  const response = await page.goto('/e2e-definitely-missing-page');
  expect(response?.status()).toBe(404);
});

test('contact requires consent and saves current evidence through server action', async ({ page }) => {
  const email = `browser-smoke-${randomUUID()}@example.invalid`;
  await page.goto('/contacts');
  const form = page.getByRole('form', { name: 'Написать через сайт' });
  await form.getByLabel('Имя', { exact: true }).fill('Browser smoke');
  await form.getByLabel('Электронная почта', { exact: true }).fill(email);
  await form.getByLabel('Сообщение', { exact: true }).fill('Local automated browser smoke fixture.');
  try {
    await form.getByRole('button', { name: 'Отправить письмо' }).click();
    expect(await form.locator('[name="acceptedPersonalData"]').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    expect(await prisma.contactRequest.count({ where: { email } })).toBe(0);
    await form.locator('[name="acceptedPersonalData"]').check();
    const before = Date.now();
    await form.getByRole('button', { name: 'Отправить письмо' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Сообщение получили' })).toBeVisible();
    const row = await prisma.contactRequest.findFirstOrThrow({ where: { email } });
    expect(row.consentVersion).toBe(personalDataConsentPublication.version);
    expect(row.consentAcceptedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.message).toBe('Local automated browser smoke fixture.');
  } finally {
    await prisma.contactRequest.deleteMany({ where: { email } });
  }
});

test('donation validates amount and consent; request remains browser-stubbed', async ({ page }) => {
  let calls = 0;
  await page.route('http://127.0.0.1:3018/api/payments/create', async route => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body.amountRoubles).toBe(500);
    expect(body.acceptedPersonalData).toBe(true);
    expect(body.acceptedOffer).toBe(true);
    expect(body.consentVersion).toBe(personalDataConsentPublication.version);
    expect(body.offerVersion).toBe(donationOfferPublication.version);
    await route.fulfill({ status: 503, json: { error: 'provider_unavailable' } });
  });
  await page.goto('http://127.0.0.1:3018/help');
  const form = page.locator('.donation-form');
  const submit = form.getByRole('button', { name: 'Оплатить онлайн' });
  await form.getByLabel('Другая сумма', { exact: true }).fill('99');
  await submit.click();
  await expect(form.getByRole('alert')).toContainText('от 100 до 100 000');
  await form.getByRole('radio', { name: '500 ₽', exact: true }).check();
  await submit.click();
  await expect(form.getByRole('alert')).toContainText('дайте согласие');
  expect(calls).toBe(0);
  await form.getByRole('checkbox').nth(0).check();
  await form.getByLabel('Email для кассового чека').fill('browser-smoke@example.invalid');
  await submit.click();
  await expect(form.getByRole('alert')).toContainText('примите оферту');
  expect(calls).toBe(0);
  await form.getByRole('checkbox').nth(1).check();
  await submit.click();
  await expect(form.getByRole('alert')).toContainText('Платежный сервис временно недоступен');
  expect(calls).toBe(1);
});

test('successful intercepted payment response navigates to local confirmation', async ({ page }) => {
  const donationId = randomUUID();
  const redirectUrl = `http://127.0.0.1:3018/donation/result?donation=${donationId}`;
  let calls = 0;
  // Simulate the destination too: no provider payment or database donation exists.
  await page.route(redirectUrl, route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html lang="ru"><title>Local payment confirmation fixture</title><h1>Local payment confirmation fixture</h1></html>',
  }));
  await page.route('http://127.0.0.1:3018/api/payments/create', async route => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body.amountRoubles).toBe(300);
    expect(body.acceptedPersonalData).toBe(true);
    expect(body.acceptedOffer).toBe(true);
    expect(body.consentVersion).toBe(personalDataConsentPublication.version);
    expect(body.offerVersion).toBe(donationOfferPublication.version);
    await route.fulfill({ status: 200, json: { donationId, redirectUrl } });
  });
  await page.goto('http://127.0.0.1:3018/help');
  const form = page.locator('.donation-form');
  await form.getByLabel('Email для кассового чека').fill('browser-smoke-success@example.invalid');
  await form.getByRole('checkbox').nth(0).check();
  await form.getByRole('checkbox').nth(1).check();
  await form.getByRole('button', { name: 'Оплатить онлайн' }).click();
  await expect(page).toHaveURL(redirectUrl);
  await expect(page.getByRole('heading', { name: 'Local payment confirmation fixture' })).toBeVisible();
  expect(calls).toBe(1);
});

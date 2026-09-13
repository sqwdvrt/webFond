import { expect, test } from '@playwright/test';

test('five sections remain usable and email survives navigation', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('header img')).toBeVisible();
  expect(await page.locator('header img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('nav button')).toHaveText(['Сборы', 'Отчет', 'Проекты', 'Новости', 'Профиль']);
  for (const label of ['Сборы', 'Отчет', 'Проекты', 'Новости', 'Профиль']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
  }
  await page.getByLabel('Электронная почта').fill('check@example.ru');
  await page.getByRole('button', { name: 'Новости', exact: true }).click();
  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await expect(page.getByLabel('Электронная почта')).toHaveValue('check@example.ru');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Сайт фонда' }).scrollIntoViewIfNeeded();
  const link = await page.getByRole('button', { name: 'Сайт фонда' }).boundingBox();
  const navigation = await page.locator('nav').boundingBox();
  expect(link!.y + link!.height).toBeLessThanOrEqual(navigation!.y);
  await page.screenshot({ path: testInfo.outputPath('profile.png'), fullPage: true });
});

test('external links have fixed destinations and do not initiate a payment', async ({ page }) => {
  await page.addInitScript(() => {
    const opened: string[] = [];
    Object.assign(window, { opened });
    window.open = (url) => { opened.push(String(url)); return null; };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Сайт фонда' }).click();
  await page.getByRole('button', { name: 'Отчет', exact: true }).click();
  await page.getByRole('button', { name: 'Проверочный PDF' }).click();
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual([
    'https://fond-bit-dobru.ru/',
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  ]);
});

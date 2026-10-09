import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('memuat layar login JOKGER', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Masuk ke JOKGER' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lewati ke konten utama' })).toBeVisible();
});

test('layar login tidak memiliki pelanggaran aksesibilitas serius', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toHaveLength(0);
});

import { expect, test } from '@playwright/test';

import { registerThroughUi } from './helpers';

test('web session survives reload and stock detail renders live quote context', async ({ page }) => {
  const email = await registerThroughUi(page);

  await expect(page.getByText(email)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email)).toBeVisible();

  await page.goto('/stocks/AAPL');
  await expect(page).toHaveURL(/\/stocks\/AAPL$/);

  await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Research workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quote summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Position summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trade context' })).toBeVisible();
});

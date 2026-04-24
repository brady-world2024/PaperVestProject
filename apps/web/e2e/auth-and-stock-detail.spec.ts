import { expect, test } from '@playwright/test';

import { registerThroughUi } from './helpers';

test('web session survives reload and stock detail renders live quote context', async ({ page }) => {
  const email = await registerThroughUi(page);

  await expect(page.getByText(email)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email)).toBeVisible();

  await page.goto('/stocks/AAPL');

  await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible();
  await expect(page.getByText(/Real-time price/).first()).toBeVisible();
  await expect(page.getByText('vs previous close').first()).toBeVisible();
  await expect(page.getByText(/Updated at .* ET/).first()).toBeVisible();
  await expect(page.getByText('Quote summary')).toBeVisible();
  await expect(page.getByText('Position summary')).toBeVisible();
});

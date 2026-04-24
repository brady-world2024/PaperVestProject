import { expect, test } from '@playwright/test';

import {
  loginThroughUi,
  registerUserThroughUi,
  signOutThroughUi,
} from './helpers';

test('login flow works through the browser UI after a real sign out', async ({ page }) => {
  const credentials = await registerUserThroughUi(page);

  await expect(page.getByText(credentials.email)).toBeVisible();
  await signOutThroughUi(page);
  await loginThroughUi(page, credentials);

  await expect(page.getByText(credentials.email)).toBeVisible();
});

test('signing out prevents protected routes from staying accessible', async ({ page }) => {
  await registerUserThroughUi(page);
  await signOutThroughUi(page);

  await page.goto('/portfolio');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});

test('dashboard search opens stock detail from a real result link', async ({ page }) => {
  await registerUserThroughUi(page);

  await page.getByPlaceholder('AAPL, Apple, NVIDIA...').fill('AAPL');
  const searchResult = page.getByRole('link', { name: /AAPL/i }).first();
  await expect(searchResult).toBeVisible();
  await searchResult.click();

  await expect(page).toHaveURL(/\/stocks\/AAPL/);
  await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible();
});

test('stock detail renders a non-empty price history chart', async ({ page }) => {
  await registerUserThroughUi(page);

  await page.goto('/stocks/AAPL');

  await expect(page.getByText('Price history')).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Historical price chart for AAPL over 1M/i })
  ).toBeVisible();
  await expect(page.getByText('Range move')).toBeVisible();
  await expect(page.getByText('Interval')).toBeVisible();
});

test('buying from stock detail updates both portfolio and activity pages', async ({ page }) => {
  await registerUserThroughUi(page);

  await page.goto('/stocks/AAPL');
  await page.locator('section.pv-stock-sidebar').getByPlaceholder('1').first().fill('1');

  const buyResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/trades/buy')
  );

  await page.getByRole('button', { name: 'Place buy order' }).click();
  const buyResponse = await buyResponsePromise;

  expect(buyResponse.status()).toBe(200);
  await expect(page.getByText('Buy order simulated successfully.')).toBeVisible();

  await page.goto('/portfolio');
  await expect(page.getByRole('banner').getByRole('heading', { name: 'Portfolio', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Holdings', exact: true })).toBeVisible();
  await expect(page.getByText('AAPL').first()).toBeVisible();
  await expect(page.getByText('1 shares').first()).toBeVisible();

  await page.goto('/activity');
  await expect(page.getByRole('heading', { name: 'Trade history' })).toBeVisible();
  await expect(page.getByText('Recent trades')).toBeVisible();
  await expect(page.getByText('AAPL').first()).toBeVisible();
  await expect(page.getByText('BUY', { exact: true }).first()).toBeVisible();
});

test('watchlist add persists across reload and remove clears it again', async ({ page }) => {
  await registerUserThroughUi(page);

  await page.goto('/stocks/AAPL');
  const watchlistToggle = page.getByRole('button', { name: 'Watchlist' });

  await watchlistToggle.click();
  await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible();

  await page.goto('/watchlist');
  await expect(page.getByRole('banner').getByRole('heading', { name: 'Watchlist', exact: true })).toBeVisible();
  await expect(page.getByText('AAPL').first()).toBeVisible();

  const watchlistRow = page.locator('.pv-list-row-wrap').filter({ hasText: 'AAPL' }).first();
  const removeResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' && response.url().endsWith('/api/watchlist/AAPL')
  );
  await watchlistRow.getByRole('button', { name: 'Remove' }).click();
  const removeResponse = await removeResponsePromise;

  expect(removeResponse.status()).toBe(204);
  await expect(page.locator('.pv-list-row-wrap')).toHaveCount(0);
  await expect(page.getByText('No symbols in your watchlist yet')).toBeVisible();
});

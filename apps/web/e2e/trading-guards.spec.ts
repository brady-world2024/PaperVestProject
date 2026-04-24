import { expect, test } from '@playwright/test';

import {
  registerThroughUi,
  removeAuthCookiesKeepXsrf,
  setCiSmokeCashBalance,
  setCiSmokeMarketSession,
} from './helpers';

test.beforeEach(async ({ request }) => {
  await setCiSmokeMarketSession(request, 'OPEN');
});

test.afterEach(async ({ request }) => {
  await setCiSmokeMarketSession(request, 'OPEN');
});

test('buy form validation blocks invalid quantities before any request is sent', async ({ page }) => {
  await registerThroughUi(page);
  await page.goto('/stocks/AAPL');

  const sidebar = page.locator('section.pv-stock-sidebar');
  const quantityInput = sidebar.getByPlaceholder('1').first();
  const buyButton = page.getByRole('button', { name: 'Place buy order' });

  let buyRequestCount = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/trades/buy')) {
      buyRequestCount += 1;
    }
  });

  await quantityInput.fill('');
  await buyButton.click();
  await expect(page.getByText('Enter the quantity to trade')).toBeVisible();

  await quantityInput.fill('0');
  await buyButton.click();
  await expect(page.getByText('Quantity must be greater than zero')).toBeVisible();

  await quantityInput.fill('-1');
  await buyButton.click();
  await expect(page.getByText('Quantity must be greater than zero')).toBeVisible();

  await quantityInput.fill('abc');
  await buyButton.click();
  await expect(page.getByText('Enter a valid number')).toBeVisible();

  await expect
    .poll(() => buyRequestCount, { message: 'invalid quantities should never submit a buy request' })
    .toBe(0);
});

test('market closed state disables buy flow and shows the regular-hours restriction', async ({ page, request }) => {
  await setCiSmokeMarketSession(request, 'CLOSED');
  await registerThroughUi(page);
  await page.goto('/stocks/AAPL');

  await expect(page.getByText('Closed').first()).toBeVisible();
  await expect(page.getByText('Last price · Market closed').first()).toBeVisible();
  await expect(
    page.getByText('Closed session. Paper trading is only available during regular market hours.').first()
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Place buy order' })).toBeDisabled();
});

test('backend insufficient-cash rejection is surfaced to the user without a false success state', async ({ page, request }) => {
  const email = await registerThroughUi(page);
  await page.goto('/stocks/AAPL');

  await expect(page.getByText('$100,000.00').first()).toBeVisible();

  const sidebar = page.locator('section.pv-stock-sidebar');
  await sidebar.getByPlaceholder('1').first().fill('1');

  await setCiSmokeCashBalance(request, email, 10);

  const buyResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/trades/buy')
  );

  await page.getByRole('button', { name: 'Place buy order' }).click();
  const buyResponse = await buyResponsePromise;

  expect(buyResponse.status()).toBe(422);
  await expect(page.getByText('You do not have enough virtual cash to place this order')).toBeVisible();
  await expect(page.getByText('Buy order simulated successfully.')).toHaveCount(0);
  await expect(page.getByText('This estimated order is larger than your available virtual cash.')).toHaveCount(0);
});

test('expired session sends the user back to login instead of showing a false trade success', async ({ page }) => {
  await registerThroughUi(page);
  await page.goto('/stocks/AAPL');

  const sidebar = page.locator('section.pv-stock-sidebar');
  await sidebar.getByPlaceholder('1').first().fill('1');
  const buyButton = page.getByRole('button', { name: 'Place buy order' });

  await removeAuthCookiesKeepXsrf(page);

  const buyResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/trades/buy') &&
      response.status() === 401
  );

  await buyButton.click();
  await buyResponsePromise;

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByText('Buy order simulated successfully.')).toHaveCount(0);
});

test('double clicking buy does not produce duplicate browser requests or duplicate success states', async ({ page }) => {
  await registerThroughUi(page);
  await page.goto('/stocks/AAPL');

  const sidebar = page.locator('section.pv-stock-sidebar');
  await sidebar.getByPlaceholder('1').first().fill('1');

  let buyRequestCount = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/trades/buy')) {
      buyRequestCount += 1;
    }
  });

  const buyButton = page.getByRole('button', { name: 'Place buy order' });
  const buyResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/trades/buy')
  );

  await buyButton.dblclick();
  const buyResponse = await buyResponsePromise;

  expect(buyResponse.status()).toBe(200);
  await expect(page.getByText('Buy order simulated successfully.')).toHaveCount(1);
  await expect
    .poll(() => buyRequestCount, { message: 'double click should still only send one buy request' })
    .toBe(1);
});

import { expect, test } from '@playwright/test';

import { registerThroughUi } from './helpers';

test('buy flow and conditional order creation work through the web UI', async ({ page }) => {
  await registerThroughUi(page);

  await page.goto('/stocks/AAPL');
  await page.getByRole('button', { name: 'Place buy order' }).waitFor();

  await page.locator('section.pv-stock-sidebar').getByPlaceholder('1').first().fill('1');
  const buyRequestPromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/trades/buy')
  );
  const buyResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/api/trades/buy')
  );
  await page.getByRole('button', { name: 'Place buy order' }).click();
  const buyRequest = await buyRequestPromise;
  const buyResponse = await buyResponsePromise;

  expect(buyRequest.headers()['x-idempotency-key']).toBeTruthy();
  expect(buyResponse.status()).toBe(200);
  await expect(page.getByText('Buy order simulated successfully.')).toBeVisible();
  await expect(page.getByText('Shares owned').first()).toBeVisible();

  await page.goto('/orders?symbol=AAPL&side=BUY');

  await page.locator('input[name="targetPrice"]').fill('210');
  await page.locator('input[name="quantity"]').fill('1');
  const createOrderRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().endsWith('/api/conditional-orders')
  );
  const createOrderResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/conditional-orders')
  );
  await page.getByRole('button', { name: 'Create conditional order' }).click();
  const createOrderRequest = await createOrderRequestPromise;
  const createOrderResponse = await createOrderResponsePromise;

  expect(createOrderRequest.postDataJSON()).toMatchObject({
    symbol: 'AAPL',
    side: 'BUY',
    targetPrice: 210,
    quantity: 1,
  });
  expect(createOrderResponse.status()).toBe(201);
  await expect(page.getByText('Conditional order created.')).toBeVisible();
  await expect(page.getByText('AAPL')).toBeVisible();
  await expect(page.getByText('ACTIVE', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' }).first()).toBeVisible();
});

import { expect, test } from '@playwright/test';

import { registerThroughUi, removeAuthCookiesKeepXsrf } from './helpers';

test('conditional-order form validation blocks invalid submissions before any request is sent', async ({
  page,
}) => {
  await registerThroughUi(page);
  await page.goto('/orders');

  const createButton = page.getByRole('button', { name: 'Create conditional order' });
  const symbolInput = page.locator('input[name="symbol"]');
  const targetPriceInput = page.locator('input[name="targetPrice"]');
  const quantityInput = page.locator('input[name="quantity"]');

  let createRequestCount = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/conditional-orders')) {
      createRequestCount += 1;
    }
  });

  await symbolInput.fill('');
  await targetPriceInput.fill('');
  await quantityInput.fill('1');
  await createButton.click();
  await expect(page.getByText('Enter a stock symbol')).toBeVisible();
  await expect(page.getByText('Enter a target price')).toBeVisible();

  await symbolInput.fill('AAPL');
  await targetPriceInput.fill('0');
  await createButton.click();
  await expect(page.getByText('Target price must be greater than zero')).toBeVisible();

  await targetPriceInput.fill('-1');
  await createButton.click();
  await expect(page.getByText('Target price must be greater than zero')).toBeVisible();

  await targetPriceInput.fill('abc');
  await createButton.click();
  await expect(page.getByText('Enter a valid price')).toBeVisible();

  await targetPriceInput.fill('210');
  await quantityInput.fill('0');
  await createButton.click();
  await expect(page.getByText('Quantity must be greater than zero')).toBeVisible();

  await quantityInput.fill('-1');
  await createButton.click();
  await expect(page.getByText('Quantity must be greater than zero')).toBeVisible();

  await quantityInput.fill('abc');
  await createButton.click();
  await expect(page.getByText('Enter a valid quantity')).toBeVisible();

  await expect
    .poll(() => createRequestCount, {
      message: 'invalid conditional-order forms should never submit a create request',
    })
    .toBe(0);
  await expect(page.getByText('Conditional order created.')).toHaveCount(0);
});

test('conditional-order creation normalizes symbol casing and surrounding spaces before submission', async ({
  page,
}) => {
  await registerThroughUi(page);
  await page.goto('/orders');

  await page.locator('input[name="symbol"]').fill('  aapl  ');
  await page.locator('input[name="targetPrice"]').fill('210');
  await page.locator('input[name="quantity"]').fill('1');

  const createOrderRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && request.url().endsWith('/api/conditional-orders')
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
  await expect(page.locator('input[name="symbol"]')).toHaveValue('AAPL');
  await expect(page.getByText('Conditional order created.')).toBeVisible();
});

test('expired session cannot create a conditional order and returns the browser to login', async ({
  page,
}) => {
  await registerThroughUi(page);
  await page.goto('/orders');

  await page.locator('input[name="symbol"]').fill('AAPL');
  await page.locator('input[name="targetPrice"]').fill('210');
  await page.locator('input[name="quantity"]').fill('1');

  await removeAuthCookiesKeepXsrf(page);

  const createOrderResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/conditional-orders') &&
      response.status() === 401
  );

  await page.getByRole('button', { name: 'Create conditional order' }).click();
  await createOrderResponsePromise;

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByText('Conditional order created.')).toHaveCount(0);
});

test('double clicking create only sends one request and creates one order', async ({ page }) => {
  await registerThroughUi(page);
  await page.goto('/orders');

  await page.locator('input[name="symbol"]').fill('AAPL');
  await page.locator('input[name="targetPrice"]').fill('210');
  await page.locator('input[name="quantity"]').fill('1');

  let createRequestCount = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/conditional-orders')) {
      createRequestCount += 1;
    }
  });

  const createButton = page.getByRole('button', { name: 'Create conditional order' });
  const createOrderResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/conditional-orders')
  );

  await createButton.dblclick();
  const createOrderResponse = await createOrderResponsePromise;

  expect(createOrderResponse.status()).toBe(201);
  await expect(page.getByText('Conditional order created.')).toHaveCount(1);
  await expect(page.getByText('ACTIVE', { exact: true })).toHaveCount(1);
  await expect
    .poll(() => createRequestCount, {
      message: 'double clicking create should still only submit one conditional-order request',
    })
    .toBe(1);
});

test('active orders show cancel and cancelling them updates the UI to a terminal state', async ({
  page,
}) => {
  await registerThroughUi(page);
  await page.goto('/orders');
  await expect(page.getByText('No conditional orders yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create conditional order' })).toBeEnabled();

  await page.locator('input[name="symbol"]').fill('AAPL');
  await page.locator('input[name="targetPrice"]').fill('210');
  await page.locator('input[name="quantity"]').fill('1');

  const createOrderResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/conditional-orders')
  );

  await page.getByRole('button', { name: 'Create conditional order' }).click();
  const createOrderResponse = await createOrderResponsePromise;

  expect(createOrderResponse.status()).toBe(201);
  await expect(page.getByText('Conditional order created.')).toBeVisible();

  const orderCard = page.locator('.pv-order-row-card').first();
  await expect(orderCard.getByText('ACTIVE', { exact: true })).toBeVisible();
  const cancelButton = orderCard.getByRole('button', { name: 'Cancel' });
  await expect(cancelButton).toBeVisible();

  const cancelResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/conditional-orders\/[^/]+\/cancel$/.test(response.url())
  );

  await cancelButton.click();
  const cancelResponse = await cancelResponsePromise;

  expect(cancelResponse.status()).toBe(200);
  await expect(orderCard.getByText('CANCELLED', { exact: true })).toBeVisible();
  await expect(orderCard.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
});

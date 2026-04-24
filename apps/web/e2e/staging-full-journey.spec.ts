import { expect, test } from '@playwright/test';

import {
  getStagingCredentialsFromEnv,
  getStagingSymbol,
  getStagingTradeQuantity,
  loginWithFixedStagingAccount,
  signOutThroughUi,
} from './helpers';

const hasStagingCredentials = Boolean(getStagingCredentialsFromEnv());
const stagingSymbol = getStagingSymbol();
const tradeQuantity = getStagingTradeQuantity();

test.describe('@staging fixed-account full journeys', () => {
  test.skip(!hasStagingCredentials, 'staging full-journey tests require fixed staging credentials');

  test('@staging login, session persistence, and logout work with the fixed staging account', async ({
    page,
  }) => {
    const credentials = await loginWithFixedStagingAccount(page);

    await expect(page.getByText(credentials.email)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(credentials.email)).toBeVisible();

    await signOutThroughUi(page);
    await page.goto('/portfolio');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  });

  test('@staging trading desk journey works end to end with the fixed staging account', async ({
    page,
  }) => {
    await loginWithFixedStagingAccount(page);

    await page.getByPlaceholder('AAPL, Apple, NVIDIA...').fill(stagingSymbol);
    const searchResult = page.getByRole('link', { name: new RegExp(stagingSymbol, 'i') }).first();
    await expect(searchResult).toBeVisible();
    await searchResult.click();

    await expect(page).toHaveURL(new RegExp(`/stocks/${stagingSymbol}`));
    await expect(page.getByRole('heading', { name: stagingSymbol })).toBeVisible();
    await expect(page.getByRole('img', { name: new RegExp(`Historical price chart for ${stagingSymbol}`, 'i') })).toBeVisible();

    await page.locator('section.pv-stock-sidebar').getByPlaceholder('1').first().fill(tradeQuantity);

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
    await expect(page.getByText(stagingSymbol).first()).toBeVisible();

    await page.goto('/activity');
    await expect(page.getByRole('heading', { name: 'Trade history' })).toBeVisible();
    await expect(page.getByText('Recent trades')).toBeVisible();

    const latestTradeCard = page.locator('.pv-subgrid > *').first();
    await expect(latestTradeCard.getByText(stagingSymbol)).toBeVisible();
    await expect(latestTradeCard.getByText('BUY', { exact: true })).toBeVisible();
  });

  test('@staging watchlist and conditional-order journey stays reusable with the fixed staging account', async ({
    page,
  }) => {
    await loginWithFixedStagingAccount(page);

    await page.goto(`/stocks/${stagingSymbol}`);
    const watchlistAddButton = page.getByRole('button', { name: 'Watchlist' });
    const watchlistRemoveButton = page.getByRole('button', { name: 'Remove' }).first();

    if (await watchlistRemoveButton.isVisible().catch(() => false)) {
      await watchlistRemoveButton.click();
      await expect(watchlistAddButton).toBeVisible();
    }

    await watchlistAddButton.click();
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible();

    await page.goto('/watchlist');
    await expect(page.getByRole('banner').getByRole('heading', { name: 'Watchlist', exact: true })).toBeVisible();
    const watchlistRow = page.locator('.pv-list-row-wrap').filter({ hasText: stagingSymbol }).first();
    await expect(watchlistRow).toBeVisible();

    const targetPrice = 5_000 + (Date.now() % 1_000);
    const formattedTargetPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(targetPrice);

    await page.goto(`/orders?symbol=${encodeURIComponent(stagingSymbol)}&side=SELL`);
    await page.locator('input[name="targetPrice"]').fill(String(targetPrice));
    await page.locator('input[name="quantity"]').fill(tradeQuantity);

    const createOrderResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/conditional-orders')
    );

    await page.getByRole('button', { name: 'Create conditional order' }).click();
    const createOrderResponse = await createOrderResponsePromise;

    expect(createOrderResponse.status()).toBe(201);

    const orderCard = page
      .locator('.pv-order-row-card')
      .filter({ hasText: stagingSymbol })
      .filter({ hasText: formattedTargetPrice })
      .first();

    await expect(orderCard).toBeVisible();
    await expect(orderCard.getByText('ACTIVE', { exact: true })).toBeVisible();

    const cancelResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/conditional-orders\/[^/]+\/cancel$/.test(response.url())
    );

    await orderCard.getByRole('button', { name: 'Cancel' }).click();
    const cancelResponse = await cancelResponsePromise;

    expect(cancelResponse.status()).toBe(200);
    await expect(orderCard.getByText('CANCELLED', { exact: true })).toBeVisible();

    await page.goto('/watchlist');
    const removableRow = page.locator('.pv-list-row-wrap').filter({ hasText: stagingSymbol }).first();
    const removeResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        response.url().endsWith(`/api/watchlist/${stagingSymbol}`)
    );
    await removableRow.getByRole('button', { name: 'Remove' }).click();
    const removeResponse = await removeResponsePromise;

    expect(removeResponse.status()).toBe(204);
    await expect(page.locator('.pv-list-row-wrap').filter({ hasText: stagingSymbol })).toHaveCount(0);
  });
});

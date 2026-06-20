import { expect, test } from '@playwright/test';

import {
  ensureUserSessionByApi,
  generateE2eCredentials,
  getAdminE2eCredentialsFromEnv,
  getApiBaseUrl,
  loginThroughUi,
  registerUserThroughUi,
} from './helpers';

test('non-admin sessions do not expose the support workspace', async ({ page }) => {
  await registerUserThroughUi(page);

  await expect(page.getByRole('link', { name: 'Support' })).toHaveCount(0);

  await page.goto('/admin/support');

  await expect(page.getByRole('heading', { name: 'Admin support console' })).toBeVisible();
  await expect(
    page.getByText('This workspace is only available to admin users bootstrapped through the backend admin configuration.')
  ).toBeVisible();
});

test('admin support console can inspect real account state for another user', async ({
  page,
  request,
}) => {
  test.skip(
    !getAdminE2eCredentialsFromEnv(),
    'admin support E2E requires PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD'
  );

  const adminCredentials = getAdminE2eCredentialsFromEnv()!;
  await ensureUserSessionByApi(request, adminCredentials);

  const memberCredentials = generateE2eCredentials();
  const memberSession = await ensureUserSessionByApi(request, memberCredentials);
  const memberAuthHeaders = {
    Authorization: `Bearer ${memberSession.accessToken}`,
  };
  const apiBaseUrl = getApiBaseUrl();

  const watchlistResponse = await request.post(`${apiBaseUrl}/watchlist`, {
    headers: memberAuthHeaders,
    data: {
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
    },
  });
  expect(watchlistResponse.status()).toBe(201);

  const buyResponse = await request.post(`${apiBaseUrl}/trades/buy`, {
    headers: {
      ...memberAuthHeaders,
      'X-Idempotency-Key': `admin-support-buy-${Date.now()}`,
    },
    data: {
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      quantity: 1,
    },
  });
  expect(buyResponse.status()).toBe(200);

  const orderResponse = await request.post(`${apiBaseUrl}/conditional-orders`, {
    headers: memberAuthHeaders,
    data: {
      symbol: 'AAPL',
      side: 'BUY',
      targetPrice: 95,
      quantity: 1,
    },
  });
  expect(orderResponse.status()).toBe(201);

  await loginThroughUi(page, adminCredentials);
  await page.goto('/admin/support');

  await expect(page.getByRole('heading', { name: 'Support command desk' })).toBeVisible();

  const searchInput = page.locator('input[name="support-user-search"]');
  await searchInput.fill(memberCredentials.email);

  const userCard = page.getByRole('button', { name: new RegExp(memberCredentials.email, 'i') }).first();
  await expect(userCard).toBeVisible();
  await userCard.click();

  await expect(page.getByText(memberCredentials.email).first()).toBeVisible();
  await expect(page.getByText('Unread notifications').first()).toBeVisible();
  await expect(page.getByText('AAPL').first()).toBeVisible();
  await expect(page.getByText('ACTIVE', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Conditional order created').first()).toBeVisible();
  await expect(page.getByText('BUY AAPL').first()).toBeVisible();
});

import { expect, type APIRequestContext, type Page } from '@playwright/test';

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:8080/api';

export type E2ECredentials = {
  email: string;
  password: string;
};

export function generateE2eCredentials(): E2ECredentials {
  return {
    email: `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`,
    password: 'SecurePass1',
  };
}

export async function registerUserThroughUi(page: Page, credentials = generateE2eCredentials()) {
  const { email, password } = credentials;

  await page.goto('/register');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('SecurePass1').nth(0).fill(password);
  await page.getByPlaceholder('SecurePass1').nth(1).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  return credentials;
}

export async function registerThroughUi(page: Page) {
  const credentials = await registerUserThroughUi(page);
  return credentials.email;
}

export async function loginThroughUi(page: Page, credentials: E2ECredentials) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(credentials.email);
  await page.getByPlaceholder('SecurePass1').fill(credentials.password);
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

export async function signOutThroughUi(page: Page) {
  const logoutResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/auth/logout')
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  const logoutResponse = await logoutResponsePromise;

  expect(logoutResponse.status(), 'expected sign out to complete with a real logout response').toBe(204);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
}

export function getStagingCredentialsFromEnv(): E2ECredentials | null {
  const email = process.env.PLAYWRIGHT_STAGING_EMAIL?.trim();
  const password = process.env.PLAYWRIGHT_STAGING_PASSWORD?.trim();

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export function getStagingSymbol() {
  return process.env.PLAYWRIGHT_STAGING_SYMBOL?.trim().toUpperCase() || 'AAPL';
}

export function getStagingTradeQuantity() {
  return process.env.PLAYWRIGHT_STAGING_TRADE_QUANTITY?.trim() || '0.0001';
}

export async function loginWithFixedStagingAccount(page: Page) {
  const credentials = getStagingCredentialsFromEnv();

  if (!credentials) {
    throw new Error('Missing PLAYWRIGHT_STAGING_EMAIL or PLAYWRIGHT_STAGING_PASSWORD');
  }

  await loginThroughUi(page, credentials);
  return credentials;
}

export async function setCiSmokeMarketSession(
  request: APIRequestContext,
  session: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS'
) {
  const response = await request.post(`${apiBaseUrl}/test-support/market-session`, {
    data: { session },
  });
  expect(response.status(), 'expected ci-smoke market session override to succeed').toBe(204);
}

export async function setCiSmokeCashBalance(
  request: APIRequestContext,
  email: string,
  cashBalance: number
) {
  const response = await request.post(`${apiBaseUrl}/test-support/cash-balance`, {
    data: { email, cashBalance },
  });
  expect(response.status(), 'expected ci-smoke cash override to succeed').toBe(204);
}

export async function removeAuthCookiesKeepXsrf(page: Page) {
  const cookies = await page.context().cookies();
  const xsrfCookie = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN');

  await page.context().clearCookies();

  if (xsrfCookie) {
    await page.context().addCookies([xsrfCookie]);
  }
}

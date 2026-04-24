import { defineConfig } from '@playwright/test';

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:8080/api';
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const useRemoteBaseUrl = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: useRemoteBaseUrl
    ? undefined
    : {
        command: 'pnpm exec next dev --port 3000',
        cwd: __dirname,
        url: 'http://127.0.0.1:3000/login',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
        },
      },
});

import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import os from 'os'
import fs from 'fs'

const e2eRunId = (
  process.env.PLAYWRIGHT_E2E_RUN_ID ||
  process.env.MDPLANE_E2E_RUN_ID ||
  `${Date.now()}-${process.pid}`
).replace(/[^a-zA-Z0-9-_]/g, '-')
const e2eDbUrl = path.join(os.tmpdir(), `mdplane-e2e-${e2eRunId}.sqlite`)
const e2eDbUrlFile = path.join(__dirname, '.e2e-db-url')
fs.writeFileSync(e2eDbUrlFile, e2eDbUrl, 'utf-8')
const e2eBackendUrl = process.env.PLAYWRIGHT_BACKEND_URL || 'http://127.0.0.1:3001'
const e2eBackendUrlFile = path.join(__dirname, '.e2e-backend-url')
fs.writeFileSync(e2eBackendUrlFile, e2eBackendUrl, 'utf-8')
const e2eBackendPort = new URL(e2eBackendUrl).port || '3001'
const e2eBackendWsUrl = process.env.NEXT_PUBLIC_WS_URL || e2eBackendUrl.replace(/^http/, 'ws')
process.env.PLAYWRIGHT_BACKEND_URL = e2eBackendUrl

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'bun run src/index.ts',
      cwd: '../server',
      url: `${e2eBackendUrl}/health`,
      reuseExistingServer: false,
      timeout: 180 * 1000,
      env: {
        NODE_ENV: 'test',
        INTEGRATION_TEST_MODE: 'true',
        DATABASE_URL: e2eDbUrl,
        HOST: '127.0.0.1',
        PORT: e2eBackendPort,
        BASE_URL: e2eBackendUrl,
        WS_URL: e2eBackendWsUrl,
        APP_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
        ADMIN_SECRET: 'test-admin-secret-for-testing-12345',
        BETTER_AUTH_SECRET: 'test-better-auth-secret-32-chars-min!!',
        BETTER_AUTH_URL: e2eBackendUrl,
      },
    },
    {
      command: 'pnpm exec next dev --port 3000',
      cwd: '.',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        ...process.env,
        PORT: '3000',
        NEXT_PUBLIC_APP_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
        NEXT_PUBLIC_API_URL: e2eBackendUrl,
        NEXT_PUBLIC_WS_URL: e2eBackendWsUrl,
        NEXT_PUBLIC_GOVERNED_MODE: 'true',
        NEXT_PUBLIC_MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS: 'true',
      },
    },
  ],
})

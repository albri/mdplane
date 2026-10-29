import { defineConfig, devices } from '@playwright/test'

const PORT = 8788

// Runs against `wrangler dev`, so the pages, the Worker, its headers and the live stream are the
// ones that ship.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  // The tests make more workspaces than a day allows, run after run.
  webServer: {
    command: `pnpm --filter @mdplane/worker exec wrangler dev --port ${PORT} --var CREATE_DAILY_LIMIT:0`,
    url: `http://localhost:${PORT}/demo`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

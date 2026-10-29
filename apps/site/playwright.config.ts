import { defineConfig, devices } from '@playwright/test'

const PORT = 8788

// Each project is its own client, with its own limits per address, as each engine's CI job is.
// Five engines from one address make more workspaces a minute than the Worker allows. Cloudflare
// sets this header itself in production; `wrangler dev` takes it from the request.
const client = (n: number) => ({ extraHTTPHeaders: { 'CF-Connecting-IP': `198.51.100.${n}` } })

// Runs against `wrangler dev`, so the pages, the Worker, its headers and the live stream are the
// ones that ship.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  // The oldest engines the build targets are Safari 17.5 and Firefox 125. Playwright's are newer,
  // so these catch engine differences, not every old version.
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...client(1) } },
    { name: 'phone', use: { ...devices['Pixel 7'], ...client(2) } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], ...client(3) } },
    {
      name: 'desktop-firefox',
      use: {
        ...devices['Desktop Firefox'],
        ...client(4),
        // Lets the page read the clipboard without Firefox's paste prompt, as Chromium's permission does.
        launchOptions: { firefoxUserPrefs: { 'dom.events.testing.asyncClipboard': true } },
      },
    },
    { name: 'phone-webkit', use: { ...devices['iPhone 15'], ...client(5) } },
  ],
  // The tests make more workspaces than a day allows, run after run.
  webServer: {
    command: `pnpm --filter @mdplane/worker exec wrangler dev --port ${PORT} --var CREATE_DAILY_LIMIT:0`,
    url: `http://localhost:${PORT}/demo`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

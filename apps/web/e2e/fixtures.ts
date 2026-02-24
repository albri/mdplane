/**
 * E2E Test Fixtures and Helpers
 *
 * Shared test data and helper functions for E2E tests.
 * Test keys are fetched dynamically from /admin/seed endpoint.
 */

import { test as base, expect, request as pwRequest, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Load test keys from file written by global-setup.
 * Process.env vars from globalSetup don't propagate to Playwright test workers,
 * so we use file-based IPC instead.
 */
function loadTestKeys(): { readKey: string; appendKey: string; writeKey: string; workspaceId: string } {
  const testKeysPath = path.join(__dirname, '.auth', 'test-keys.json');
  try {
    const content = fs.readFileSync(testKeysPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Fall back to empty keys if file not found (e.g., running single test without global setup)
    console.warn('Warning: test-keys.json not found. Run full test suite to generate test keys.');
    return { readKey: '', appendKey: '', writeKey: '', workspaceId: '' };
  }
}

// Test keys - loaded from file written by global-setup
export const TEST_KEYS = loadTestKeys();

// Backend URL
const BACKEND_URL_FILE = path.join(__dirname, '..', '.e2e-backend-url');
export const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL ||
  (fs.existsSync(BACKEND_URL_FILE)
    ? fs.readFileSync(BACKEND_URL_FILE, 'utf-8').trim()
    : 'http://127.0.0.1:3101');

// Frontend URL
export const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

// Test file paths that should exist after seeding
export const TEST_FILES = {
  readme: '/README.md',
  docsGettingStarted: '/docs/getting-started.md',
  docsApiReference: '/docs/api-reference.md',
  examplesBacklog: '/examples/backlog.md',
  srcIndex: '/src/index.ts',
};

// Test folders that should exist after seeding
export const TEST_FOLDERS = {
  docs: '/docs',
  examples: '/examples',
  src: '/src',
};

/**
 * Set up fail-fast error detection on a page
 * Throws immediately on page errors or critical console errors
 */
function setupFailFastErrorDetection(page: Page): void {
  page.on('pageerror', (error) => {
    throw new Error(`Page error detected: ${error.message}\n\nStack: ${error.stack}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();

      if (text.includes('invariant expected layout router to be mounted')) {
        return;
      }

      if (text.includes('expected to be defined') ||
          text.includes('Cannot read properties of undefined')) {
        throw new Error(`Critical console error detected: ${text}`);
      }
    }
  });
}

// Storage state path - absolute path to avoid CWD issues
const AUTH_STATE_PATH = path.join(__dirname, '.auth', 'user.json');

async function createApiRequest() {
  return await pwRequest.newContext({
    baseURL: BACKEND_URL,
  });
}

async function createAuthedRequest() {
  return await pwRequest.newContext({
    baseURL: BACKEND_URL,
    storageState: AUTH_STATE_PATH,
  });
}

// Authenticated fixture used for control-plane and claimed-workspace flows.
export const authenticatedTest = base.extend<{
  readKey: string;
  appendKey: string;
  writeKey: string;
  workspaceId: string;
  authedRequest: Awaited<ReturnType<typeof createAuthedRequest>>;
}>({
  // Set storageState at fixture level to ensure it's applied consistently
  storageState: AUTH_STATE_PATH,

  readKey: TEST_KEYS.readKey,
  appendKey: TEST_KEYS.appendKey,
  writeKey: TEST_KEYS.writeKey,
  workspaceId: TEST_KEYS.workspaceId,

  page: async ({ page }, use) => {
    setupFailFastErrorDetection(page);
    await use(page);
  },

  request: async ({}, use) => {
    const ctx = await createApiRequest();
    await use(ctx);
    await ctx.dispose();
  },

  authedRequest: async ({}, use) => {
    const ctx = await createAuthedRequest();
    await use(ctx);
    await ctx.dispose();
  },
});

// Public fixture without storageState for workspace/capability flows.
export const publicTest = base.extend<{
  readKey: string;
  appendKey: string;
  writeKey: string;
  workspaceId: string;
}>({
  // Custom fixtures
  readKey: TEST_KEYS.readKey,
  appendKey: TEST_KEYS.appendKey,
  writeKey: TEST_KEYS.writeKey,
  workspaceId: TEST_KEYS.workspaceId,

  // Set up fail-fast error detection for each page
  page: async ({ page }, use) => {
    setupFailFastErrorDetection(page);
    await use(page);
  },
});

export { expect };

// Backward-compatible aliases.
export const test = authenticatedTest;
export const unauthTest = publicTest;

// Export unauthenticated request for negative auth tests
export const unauthRequest = pwRequest;


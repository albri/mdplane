import { FullConfig, chromium } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getRetryDelayMs, isRetryableClaimFailure } from './setup-retry-utils';

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

const E2E_DB_URL_FILE = path.join(__dirname, '..', '.e2e-db-url');
const E2E_BACKEND_URL_FILE = path.join(__dirname, '..', '.e2e-backend-url');
const E2E_DB_URL = fs.existsSync(E2E_DB_URL_FILE)
  ? fs.readFileSync(E2E_DB_URL_FILE, 'utf-8').trim()
  : path.join(os.tmpdir(), 'mdplane-e2e.sqlite');
const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL ||
  (fs.existsSync(E2E_BACKEND_URL_FILE)
    ? fs.readFileSync(E2E_BACKEND_URL_FILE, 'utf-8').trim()
    : 'http://127.0.0.1:3001');

const TEST_USER = {
  email: 'e2e-test@example.com',
  password: 'test-e2e-password-12345',
};

const STORAGE_STATE_PATH = path.join(__dirname, '.auth', 'user.json');

export const TEST_KEYS = {
  readKey: '',
  appendKey: '',
  writeKey: '',
  workspaceId: '',
};

async function waitForBackend(maxAttempts = 30, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        console.log(`✓ Backend is ready at ${BACKEND_URL}`);
        return;
      }
    } catch {}

    if (attempt < maxAttempts) {
      console.log(`Waiting for backend... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Backend at ${BACKEND_URL} is not responding after ${maxAttempts} attempts`);
}

async function isSeededWorkspaceVisible(): Promise<boolean> {
  if (!TEST_KEYS.readKey) return false;

  try {
    const response = await fetch(`${BACKEND_URL}/r/${encodeURIComponent(TEST_KEYS.readKey)}/folders`);
    if (!response.ok) return false;
    const body = await response.text();
    if (!body.trim()) return false;
    const json = JSON.parse(body) as { ok?: boolean };
    return json.ok === true;
  } catch {
    return false;
  }
}

async function waitForSeededWorkspace(maxAttempts = 20, delayMs = 250): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await isSeededWorkspaceVisible()) {
      console.log(`  V Seeded workspace is visible on backend`);
      return;
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `Seeded workspace is not visible on backend ${BACKEND_URL}. ` +
    `readKey=${TEST_KEYS.readKey.slice(0, 8)}..., db=${E2E_DB_URL}`
  );
}

function seedTestData(): { workspaceId: string } {
  console.log('Seeding test database directly...');

  const serverDir = path.resolve(__dirname, '../../server');
  const seedScript = path.join(serverDir, 'scripts/e2e-seed.ts');

  console.log(`  Running: bun run ${seedScript}`);

  const output = execSync(`bun run ${seedScript}`, {
    cwd: serverDir,
    env: {
      ...process.env,
      DATABASE_URL: E2E_DB_URL,
    },
    encoding: 'utf-8',
  });

  const lines = output.trim().split('\n');
  const jsonLine = lines.find((line) => line.startsWith('{'));
  if (!jsonLine) {
    throw new Error(`Seed script did not output valid JSON. Output:\n${output}`);
  }
  const data = JSON.parse(jsonLine);

  TEST_KEYS.readKey = data.readKey || '';
  TEST_KEYS.appendKey = data.appendKey || '';
  TEST_KEYS.writeKey = data.writeKey || '';
  TEST_KEYS.workspaceId = data.workspaceId || '';

  console.log(`✓ Test data seeded successfully`);
  console.log(`  Database: ${E2E_DB_URL}`);
  console.log(`  Workspace: ${data.workspaceId}`);
  console.log(`  Files: ${data.files?.length || 0}`);

  return { workspaceId: data.workspaceId || '' };
}

async function createAuthenticatedSession(): Promise<void> {
  console.log('Creating authenticated session for E2E tests...');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: FRONTEND_URL,
  });

  try {
    // First, try to sign up (will fail if user exists, which is fine)
    const signUpResponse = await context.request.post(`${BACKEND_URL}/api/auth/sign-up/email`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: 'E2E Test User',
      },
    });

    // If sign-up fails (user might already exist), try sign-in
    if (!signUpResponse.ok()) {
      console.log('  Sign-up failed (user may exist), attempting sign-in...');

      const signInResponse = await context.request.post(`${BACKEND_URL}/api/auth/sign-in/email`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          email: TEST_USER.email,
          password: TEST_USER.password,
        },
      });

      if (!signInResponse.ok()) {
        const errorText = await signInResponse.text();
        throw new Error(`Failed to sign in: ${signInResponse.status()} ${errorText}`);
      }

      console.log('  ✓ Signed in successfully');
    } else {
      console.log('  ✓ Signed up successfully');
    }

    // Ensure storageState directory exists
    const storageDir = path.dirname(STORAGE_STATE_PATH);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    // Save storage state (includes session cookies)
    await context.storageState({ path: STORAGE_STATE_PATH });
    console.log(`  ✓ Session saved to ${STORAGE_STATE_PATH}`);

  } finally {
    await browser.close();
  }
}

/**
 * Claim the seeded workspace so the signed-in user becomes the workspace owner.
 */
async function claimSeededWorkspace(context: import('@playwright/test').BrowserContext): Promise<void> {
  if (!TEST_KEYS.writeKey) {
    throw new Error('Missing TEST_KEYS.writeKey (seed did not return a write key)');
  }

  console.log('Claiming seeded workspace for E2E user...');
  const maxAttempts = 40;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await context.request.post(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}/claim`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });

    if (response.ok()) {
      console.log('  ✓ Workspace claimed successfully');
      return;
    }

    const responseBody = await response.text();
    if (isRetryableClaimFailure(response.status(), responseBody) && attempt < maxAttempts) {
      if (response.status() === 404) {
        const visible = await isSeededWorkspaceVisible();
        if (!visible) {
          throw new Error(
            `Claim failed with 404 and seeded workspace is not visible on ${BACKEND_URL}. ` +
            `writeKey=${TEST_KEYS.writeKey.slice(0, 8)}..., db=${E2E_DB_URL}`
          );
        }
      }
      await new Promise(resolve => setTimeout(resolve, getRetryDelayMs(attempt)));
      continue;
    }

    throw new Error(`Failed to claim workspace: ${response.status()} ${responseBody}`);
  }

  throw new Error('Failed to claim workspace after retry attempts');
}

/**
 * Verify the session works by making an authenticated request to the control surface.
 * This catches session issues early before tests run.
 */
async function verifySessionWorks(): Promise<void> {
  console.log('Verifying session works...');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: FRONTEND_URL,
    storageState: STORAGE_STATE_PATH
  });

  try {
    const page = await context.newPage();

    // Navigate to control and wait for it to load
    await page.goto('/control');
    await page.waitForLoadState('networkidle');

    // Check if we were redirected to login (session invalid)
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error(
        `Session verification failed: redirected to login. ` +
        `The session cookie may not be valid. URL: ${currentUrl}`
      );
    }

    // Verify we're on the control surface
    if (!currentUrl.includes('/control')) {
      throw new Error(
        `Session verification failed: unexpected URL ${currentUrl}`
      );
    }

    console.log('  ✓ Session verified - control accessible');
  } finally {
    await browser.close();
  }
}

/**
 * Global setup function - runs once before all tests
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n🚀 Starting E2E Test Setup\n');

  try {
    // Step 1: Seed test data BEFORE server starts (it needs the seeded database)
    // This runs synchronously and creates the database file
    const { workspaceId } = seedTestData();

    // Step 2: Wait for backend (Playwright will start it with the seeded database)
    await waitForBackend();
    await waitForSeededWorkspace();

    // Step 3: Create authenticated session for control tests
    await createAuthenticatedSession();

    // Step 4: Claim seeded workspace so API key endpoints authorize this user
    {
      const browser = await chromium.launch();
      const context = await browser.newContext({ baseURL: FRONTEND_URL, storageState: STORAGE_STATE_PATH });
      try {
        await claimSeededWorkspace(context);
      } finally {
        await browser.close();
      }
    }

    // Step 5: Verify the session actually works before running tests
    // This catches auth issues early and provides better error messages
    await verifySessionWorks();

    // Step 6: Write test keys to file for test workers to read
    // Note: process.env vars set here don't propagate to Playwright test workers
    const testKeysPath = path.join(__dirname, '.auth', 'test-keys.json');
    fs.writeFileSync(testKeysPath, JSON.stringify({
      readKey: TEST_KEYS.readKey,
      appendKey: TEST_KEYS.appendKey,
      writeKey: TEST_KEYS.writeKey,
      workspaceId: workspaceId,
    }, null, 2));
    console.log(`  ✓ Test keys saved to ${testKeysPath}`);

    console.log(`  Read Key: ${TEST_KEYS.readKey.substring(0, 12)}...`);
    console.log(`  Append Key: ${TEST_KEYS.appendKey.substring(0, 12)}...`);
    console.log(`  Write Key: ${TEST_KEYS.writeKey.substring(0, 12)}...`);

    console.log('\n✓ E2E Test Setup Complete\n');
  } catch (error) {
    console.error('\n✗ E2E Test Setup Failed:', error);
    throw error;
  }
}

export default globalSetup;


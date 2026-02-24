import { type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import process from 'node:process';
import { CONFIG } from './config';
import { bootstrap, checkConnectivity } from './helpers/api-client';
import { registerWorkspace } from './helpers/cleanup';
import { spawnBun } from './helpers/bun-command';

function cleanupDatabase(): void {
  const dbPath = resolve(CONFIG.TEST_DB_PATH);

  if (process.env.INTEGRATION_TEST_PRESERVE_DB === 'true') {
    // Preserve DB during intentional mid-run restarts.
    return;
  }

  if (existsSync(dbPath)) {
    console.log(`[setup] Deleting existing database: ${dbPath}`);
    unlinkSync(dbPath);
  }

  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    console.log(`[setup] Creating data directory: ${dbDir}`);
    mkdirSync(dbDir, { recursive: true });
  }
}

function initializeDatabase(): void {
  console.log('[setup] Database will be initialized by server on first run...');
  console.log('[setup] Skipping drizzle-kit push (server will handle schema initialization)');
}

async function checkPortAvailable(): Promise<void> {
  try {
    await checkConnectivity();
    throw new Error(
      'Port 3001 is already occupied. Stop the running server process and re-run integration tests.'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Port 3001 is already occupied')) {
      throw error;
    }
  }
}

async function startServer(): Promise<ChildProcess> {
  console.log('[setup] Starting local server...');

  const serverDir = resolve(import.meta.dir, '../../');
  const serverProcess = spawnBun(['run', 'src/index.ts'], {
    cwd: serverDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '3001',
      DATABASE_URL: CONFIG.TEST_DB_URL,
      BASE_URL: 'http://127.0.0.1:3001',
      WS_URL: 'ws://127.0.0.1:3001/ws',
      ADMIN_SECRET: process.env.ADMIN_SECRET ?? 'test-admin-secret-for-testing-12345',
      DISABLE_BACKGROUND_JOBS: 'true',
      INTEGRATION_TEST_MODE: 'true',
      BETTER_AUTH_SECRET: 'test-secret-123456789012345678901234567890',
      BETTER_AUTH_URL: 'http://127.0.0.1:3001',
    },
  });

  serverProcess.on('error', (error) => {
    throw new Error(`Failed to spawn server process: ${error.message}`);
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log(`[server stdout] ${data.toString().trim()}`);
  });
  serverProcess.stderr?.on('data', (data) => {
    console.error(`[server stderr] ${data.toString().trim()}`);
  });

  console.log(`[setup] Server started with PID: ${String(serverProcess.pid ?? 'unknown')}`);

  console.log('[setup] Waiting for server to be ready...');
  const startTime = Date.now();
  const timeout = CONFIG.TIMEOUTS.SERVER_STARTUP;

  while (Date.now() - startTime < timeout) {
    try {
      await checkConnectivity();
      console.log('[setup] Server is ready');
      return serverProcess;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  serverProcess.kill('SIGKILL');
  throw new Error(`Server failed to start within ${String(timeout)}ms`);
}

/** Start server without DB cleanup or seeding. */
export async function startServerOnly(): Promise<ChildProcess> {
  return startServer();
}

async function seedTestData(): Promise<void> {
  console.log('[setup] Seeding initial test data...');

  const workspace = await bootstrap('__int_shared');
  registerWorkspace(workspace);

  console.log(`[setup] Created shared workspace: ${workspace.workspaceId}`);
}

export async function setup(): Promise<{
  serverProcess: ChildProcess;
  baseUrl: string;
}> {
  console.log('🔧 Integration Tests Setup');
  console.log(`   Test API URL: ${CONFIG.TEST_API_URL}`);
  console.log(`   Database: ${CONFIG.TEST_DB_URL}`);
  console.log('');

  console.log('[setup] Checking port availability...');
  await checkPortAvailable();
  cleanupDatabase();
  initializeDatabase();
  const serverProcess = await startServer();
  await seedTestData();

  console.log('');
  console.log('✓ Setup complete');

  return {
    serverProcess,
    baseUrl: CONFIG.TEST_API_URL,
  };
}

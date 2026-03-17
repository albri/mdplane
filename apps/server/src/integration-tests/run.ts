import { type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { setup, startServerOnly } from './setup';
import { stopServer, teardown } from './teardown';
import { spawnBun } from './helpers/bun-command';

function loadEnvFile(): void {
  const envPath = resolve(import.meta.dir, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const text = readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const { CONFIG } = await import('./config');

process.env.DATABASE_URL ??= CONFIG.TEST_DB_URL;
process.env.BASE_URL ??= 'http://127.0.0.1:3001';
process.env.WS_URL ??= 'ws://127.0.0.1:3001/ws';
process.env.APP_URL ??= 'http://127.0.0.1:3000';
process.env.BETTER_AUTH_URL ??= 'http://127.0.0.1:3001';
process.env.ADMIN_SECRET ??= 'test-admin-secret-for-testing-12345';

console.log('🧪 Integration Tests');
console.log(`   Target: ${CONFIG.TEST_API_URL}`);
console.log(`   Database: ${CONFIG.TEST_DB_PATH}`);
console.log('');

const args = process.argv;
const sepIndex = args.indexOf('--');
const forwarded = sepIndex === -1 ? args.slice(2) : args.slice(sepIndex + 1);
const testTargets = forwarded.length > 0 ? forwarded : ['tests/'];

let serverProcess: ChildProcess | null = null;
let testExitCode: number | null = null;
let teardownStarted = false;

async function teardownOnce(context: string): Promise<void> {
  if (teardownStarted || !serverProcess) {
    return;
  }

  teardownStarted = true;
  const processToStop = serverProcess;
  serverProcess = null;

  console.log(`[run] ${context}`);
  try {
    await teardown(processToStop, CONFIG.TEST_API_URL);
  } catch (error) {
    console.error('[run] Teardown error:', error instanceof Error ? error.message : String(error));
  }
}

async function handleSignal(signal: string): Promise<never> {
  console.log(`[run] Received ${signal}, shutting down...`);
  await teardownOnce('Running teardown after signal...');
  process.exit(130);
}

process.on('SIGINT', () => {
  void handleSignal('SIGINT');
});

process.on('SIGTERM', () => {
  void handleSignal('SIGTERM');
});

function listTestFiles(dir: string): string[] {
  const absDir = resolve(import.meta.dir, dir);
  const files: string[] = [];

  const walk = (abs: string) => {
    for (const entry of readdirSync(abs)) {
      const full = join(abs, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.endsWith('.test.ts')) {
        files.push(relative(resolve(import.meta.dir), full));
      }
    }
  };

  walk(absDir);
  return files.sort();
}

async function runBunTests(targets: string[]): Promise<number> {
  const testProcess = spawnBun(['test', ...targets], {
    cwd: import.meta.dir,
    stdio: 'inherit',
    env: { ...process.env },
  });

  const { exitCode } = await new Promise<{ exitCode: number | null }>((resolve, reject) => {
    testProcess.on('error', reject);
    testProcess.on('exit', (code) => resolve({ exitCode: code }));
  });

  return exitCode ?? 1;
}

try {
  console.log('[run] Starting setup...');
  const setupResult = await setup();
  serverProcess = setupResult.serverProcess;
  console.log('[run] Setup complete');

  console.log('[run] Running tests...');
  console.log('[run] Waiting 2 seconds for server to stabilize...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const restartCountRaw = process.env.INTEGRATION_TEST_RESTARTS;
  const restartCountParsed = restartCountRaw ? Number.parseInt(restartCountRaw, 10) : NaN;
  const restartCount = Number.isFinite(restartCountParsed) ? Math.max(0, restartCountParsed) : 0;
  const isDefaultTestsDir = testTargets.length === 1 && (testTargets[0] === 'tests/' || testTargets[0] === 'tests');

  if (restartCount > 0 && isDefaultTestsDir) {
    const files = listTestFiles('tests');
    const batches = restartCount + 1;
    const batchSize = Math.max(1, Math.ceil(files.length / batches));

    console.log(
      `[run] Restart enabled: restarts=${restartCount} batches=${batches} batchSize≈${batchSize} totalFiles=${files.length}`
    );

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(files.length, (i + 1) * batchSize);
      const batch = files.slice(start, end);
      if (batch.length === 0) break;

      console.log(`[run] Batch ${i + 1}/${batches}: running ${batch.length} test files`);
      testExitCode = await runBunTests(batch);
      if (testExitCode !== 0) {
        throw new Error(`Batch ${String(i + 1)} failed with exit code ${String(testExitCode)}`);
      }

      if (i < batches - 1) {
        if (!serverProcess) {
          throw new Error('Missing server process for restart');
        }

        console.log('[run] Restarting server (preserving DB) ...');
        await stopServer(serverProcess);
        process.env.INTEGRATION_TEST_PRESERVE_DB = 'true';
        serverProcess = await startServerOnly();

        console.log('[run] Waiting 2 seconds for restarted server to stabilize...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else {
    testExitCode = await runBunTests(testTargets);
  }
} catch (error) {
  console.error('[run] Error:', error instanceof Error ? error.message : String(error));
  testExitCode = 1;
} finally {
  await teardownOnce('Running teardown...');
}

process.exit(testExitCode);

import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, watch } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATIC_FILES = [
  'index.html',
  'styles.css',
  'favicon.ico',
  'apple-icon.png',
  'icon.svg',
  'site.webmanifest',
  'web-app-manifest-192x192.png',
  'web-app-manifest-512x512.png',
];
const DEV_PORT = '3000';

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

function copyStaticFile(appDir, distDir, file) {
  copyFileSync(path.join(appDir, file), path.join(distDir, file));
}

function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', () => {
      reject(new Error(`Port ${port} is already in use`));
    });

    server.once('listening', () => {
      server.close(() => resolve());
    });

    server.listen(Number(port), '::');
  });
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const appDir = path.resolve(scriptDir, '..');
  const distDir = path.join(appDir, 'dist');

  await assertPortAvailable(DEV_PORT);

  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  run('pnpm', ['exec', 'tsc', '--project', 'tsconfig.json'], appDir);

  for (const file of STATIC_FILES) {
    copyStaticFile(appDir, distDir, file);
  }

  const tscWatch = spawn(
    'pnpm',
    ['exec', 'tsc', '--project', 'tsconfig.json', '--watch', '--preserveWatchOutput'],
    { cwd: appDir, stdio: 'inherit' },
  );

  const server = spawn(
    'python3',
    ['-m', 'http.server', DEV_PORT, '-d', 'dist'],
    { cwd: appDir, stdio: 'inherit' },
  );

  const watchers = STATIC_FILES
    .map((file) => path.join(appDir, file))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => watch(filePath, () => {
      copyStaticFile(appDir, distDir, path.basename(filePath));
    }));

  const shutdown = (exitCode = 0) => {
    for (const fileWatcher of watchers) {
      fileWatcher.close();
    }

    tscWatch.kill('SIGTERM');
    server.kill('SIGTERM');
    process.exit(exitCode);
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  tscWatch.on('exit', (code) => shutdown(code ?? 1));
  server.on('exit', (code) => shutdown(code ?? 1));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown dev startup error';
  console.error(message);
  process.exit(1);
});

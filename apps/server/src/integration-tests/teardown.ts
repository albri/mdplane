/**
 * Integration Tests Teardown
 *
 * Server shutdown and cleanup after integration tests.
 */

import { cleanupAllTestData } from './helpers/cleanup';
import { spawnSync, type ChildProcess } from 'node:child_process';
import process from 'node:process';

function forceKillWindowsProcessTree(pid: number): void {
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
    stdio: 'ignore',
  });
}

/**
 * Stop server process
 *
 * Sends SIGTERM first, then SIGKILL if needed without throwing.
 */
export async function stopServer(serverProcess: ChildProcess): Promise<void> {
  console.log('[teardown] Stopping server...');

  try {
    if (process.platform === 'win32' && serverProcess.pid != null) {
      // On Windows, integration server can be launched via cmd shim; kill the full tree.
      forceKillWindowsProcessTree(serverProcess.pid);
    } else {
      // Send SIGTERM for graceful shutdown
      serverProcess.kill('SIGTERM');
    }

    // Wait up to 5 seconds for graceful shutdown
    const timeout = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
        console.log('[teardown] Server stopped gracefully');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Force kill if still running
    if (serverProcess.exitCode === null && serverProcess.signalCode === null) {
      console.log('[teardown] Force killing server...');
      if (process.platform === 'win32' && serverProcess.pid != null) {
        forceKillWindowsProcessTree(serverProcess.pid);
      } else {
        serverProcess.kill('SIGKILL');
      }
    }
  } catch (error) {
    // Log error but don't throw - we want teardown to complete
    console.error('[teardown] Error stopping server:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Run teardown
 */
export async function teardown(serverProcess: ChildProcess, _baseUrl: string): Promise<void> {
  console.log('');
  console.log('🧹 Integration Tests Teardown');
  console.log('');

  await cleanupAllTestData();
  await stopServer(serverProcess);

  console.log('');
  console.log('✓ Teardown complete');
}

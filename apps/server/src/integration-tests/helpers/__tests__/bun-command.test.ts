import { describe, expect, test } from 'bun:test';
import { resolveBunCommand, shouldUseCmdShimOnWindows } from '../bun-command';

describe('resolveBunCommand', () => {
  test('prefers explicit env override', () => {
    const command = resolveBunCommand({
      platform: 'win32',
      execPath: 'C:\\bun\\bun.exe',
      env: { MDPLANE_BUN_BIN: 'C:\\custom\\bun.cmd' },
      pathExists: () => false,
    });

    expect(command).toBe('C:\\custom\\bun.cmd');
  });

  test('uses bun.cmd fallback when execPath points to bundled bun.exe', () => {
    const command = resolveBunCommand({
      platform: 'win32',
      execPath: 'C:\\Users\\alex-\\.config\\herd\\bin\\nvm\\v22.9.0\\node_modules\\bun\\bin\\bun.exe',
      env: {},
      pathExists: (path) => path.endsWith('bun.cmd'),
    });

    expect(command).toBe('C:\\Users\\alex-\\.config\\herd\\bin\\nvm\\v22.9.0\\bun.cmd');
  });

  test('uses explicit execPath when not bundled bun.exe on windows', () => {
    const command = resolveBunCommand({
      platform: 'win32',
      execPath: 'C:\\tools\\bun\\bun.exe',
      env: {},
      pathExists: () => false,
    });

    expect(command).toBe('C:\\tools\\bun\\bun.exe');
  });

  test('falls back to bun.cmd when no direct candidate exists', () => {
    const command = resolveBunCommand({
      platform: 'win32',
      execPath: 'C:\\Users\\alex-\\.config\\herd\\bin\\nvm\\v22.9.0\\node_modules\\bun\\bin\\bun.exe',
      env: {},
      pathExists: () => false,
    });

    expect(command).toBe('bun.cmd');
  });

  test('prefers current bun execPath on non-windows', () => {
    const command = resolveBunCommand({
      platform: 'linux',
      execPath: '/usr/local/bin/bun',
      env: {},
      pathExists: () => false,
    });

    expect(command).toBe('/usr/local/bin/bun');
  });

  test('falls back to bun on non-windows when execPath is not bun', () => {
    const command = resolveBunCommand({
      platform: 'linux',
      execPath: '/usr/bin/node',
      env: {},
      pathExists: () => false,
    });

    expect(command).toBe('bun');
  });
});

describe('shouldUseCmdShimOnWindows', () => {
  test('requires cmd shim for windows cmd commands', () => {
    expect(shouldUseCmdShimOnWindows({ platform: 'win32', command: 'bun.cmd' })).toBe(true);
    expect(shouldUseCmdShimOnWindows({ platform: 'win32', command: 'C:\\tools\\bun.cmd' })).toBe(true);
  });

  test('does not require cmd shim for windows executables', () => {
    expect(shouldUseCmdShimOnWindows({ platform: 'win32', command: 'C:\\tools\\bun.exe' })).toBe(false);
  });

  test('does not require cmd shim outside windows', () => {
    expect(shouldUseCmdShimOnWindows({ platform: 'linux', command: 'bun.cmd' })).toBe(false);
  });
});

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import process from 'node:process';
import { existsSync } from 'node:fs';

export type ResolveBunCommandInput = {
  platform: NodeJS.Platform;
  execPath: string;
  env: NodeJS.ProcessEnv;
  pathExists: (path: string) => boolean;
};

type ShouldUseCmdShimOnWindowsInput = {
  platform: NodeJS.Platform;
  command: string;
};

function isBunExecutablePath(execPath: string): boolean {
  const file = basename(execPath).toLowerCase();
  return file === 'bun' || file === 'bun.exe';
}

function isBundledBunBinary(execPath: string): boolean {
  const normalized = execPath.replace(/\//g, '\\').toLowerCase();
  return normalized.includes('\\node_modules\\bun\\bin\\bun.exe');
}

export function resolveBunCommand(
  input: ResolveBunCommandInput = {
    platform: process.platform,
    execPath: process.execPath,
    env: process.env,
    pathExists: existsSync,
  }
): string {
  const override = input.env.MDPLANE_BUN_BIN?.trim();
  if (override) {
    return override;
  }

  if (input.platform === 'win32') {
    if (isBunExecutablePath(input.execPath) && !isBundledBunBinary(input.execPath)) {
      return input.execPath;
    }

    const candidate = resolve(dirname(input.execPath), '..', '..', '..', 'bun.cmd');
    if (input.pathExists(candidate)) {
      return candidate;
    }

    return 'bun.cmd';
  }

  if (isBunExecutablePath(input.execPath)) {
    return input.execPath;
  }
  return 'bun';
}

export function shouldUseCmdShimOnWindows(input: ShouldUseCmdShimOnWindowsInput): boolean {
  if (input.platform !== 'win32') {
    return false;
  }

  const command = input.command.trim().toLowerCase();
  return command === 'bun.cmd' || command.endsWith('.cmd');
}

export function spawnBun(
  args: string[],
  options: SpawnOptions
): ChildProcess {
  const command = resolveBunCommand();
  if (shouldUseCmdShimOnWindows({ platform: process.platform, command })) {
    return spawn('cmd.exe', ['/d', '/s', '/c', command, ...args], options);
  }

  return spawn(command, args, options);
}

/**
 * Config path builders and discovery.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const CONFIG_DIR = '.mdplane';
const GLOBAL_CONFIG_FILENAME = 'config.json';
const OLD_CONFIG_FILENAME = '.mdplane';

/**
 * Get the global config directory (XDG/AppData)
 */
export function getGlobalConfigDir(): string {
  const platform = os.platform();
  if (platform === 'win32') {
    return path.join(process.env.APPDATA ?? '', 'mdplane');
  }
  return path.join(os.homedir(), '.config', 'mdplane');
}

/**
 * Get the global config file path
 */
export function getGlobalConfigPath(): string {
  return path.join(getGlobalConfigDir(), GLOBAL_CONFIG_FILENAME);
}

/**
 * Get the repo-local config directory path (for override)
 */
export function getRepoLocalConfigDir(): string {
  return path.join(process.cwd(), CONFIG_DIR);
}

/**
 * Get the repo-local config file path
 */
export function getRepoLocalConfigPath(): string {
  return path.join(getRepoLocalConfigDir(), GLOBAL_CONFIG_FILENAME);
}

/**
 * Get the old-style config file path (for backward compatibility)
 */
export function getOldConfigPath(): string {
  return path.join(process.cwd(), OLD_CONFIG_FILENAME);
}

/**
 * Find which config file to use (precedence: repo-local > global)
 */
export function findConfigPath(): string | null {
  const repoLocalPath = getRepoLocalConfigPath();
  if (fs.existsSync(repoLocalPath)) {
    return repoLocalPath;
  }

  const globalPath = getGlobalConfigPath();
  if (fs.existsSync(globalPath)) {
    return globalPath;
  }

  const oldPath = getOldConfigPath();
  if (fs.existsSync(oldPath)) {
    return oldPath;
  }

  return null;
}


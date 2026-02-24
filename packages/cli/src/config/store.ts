/**
 * Config load/save operations.
 */
import * as fs from 'node:fs';
import type { CliConfig, MdPlaneConfig } from './types.js';
import {
  findConfigPath,
  getGlobalConfigDir,
  getGlobalConfigPath,
  getRepoLocalConfigDir,
  getRepoLocalConfigPath,
} from './paths.js';
import { isOldConfigFormat, migrateOldConfig } from './migrate.js';

function parseConfig(data: unknown): CliConfig {
  if (isOldConfigFormat(data)) {
    return migrateOldConfig(data as MdPlaneConfig);
  }
  return data as CliConfig;
}

/**
 * Load config from a specific file path.
 */
export function loadConfigFromPath(configPath: string): CliConfig | null {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(content) as unknown;
    return parseConfig(data);
  } catch {
    return null;
  }
}

/**
 * Load the CLI config (with profiles)
 */
export function loadConfig(): CliConfig | null {
  const configPath = findConfigPath();
  if (configPath == null) {
    return null;
  }
  return loadConfigFromPath(configPath);
}

/**
 * Save CLI config to global or repo-local location
 */
export function saveConfig(config: CliConfig, repoLocal = false): void {
  const configPath = repoLocal ? getRepoLocalConfigPath() : getGlobalConfigPath();
  const configDir = repoLocal ? getRepoLocalConfigDir() : getGlobalConfigDir();

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

import type { Command } from 'commander';
import chalk from 'chalk';
import {
  loadConfig,
  getActiveProfile,
  getApiUrl,
  getCapabilityKeys,
  extractKeyFromUrl,
  maskKey,
} from '../config.js';
import { ApiClient, type CapabilityCheckResult } from '../api.js';
import {
  error,
  info,
  success,
  header,
  keyValue,
  output,
  outputError,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction } from './_runtime/index.js';

interface CheckKeysOptions extends OutputOptions {
  profile?: string;
}

export function registerCheckKeysCommand(program: Command): void {
  program
    .command('check-keys [keys...]')
    .description('Validate capability keys are still active')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Check configured keys from current profile:
    $ mdplane check-keys

  Check specific keys:
    $ mdplane check-keys x8k2mP9qL3nR 3kL9mQ2pN7xR

  Check keys with JSON output:
    $ mdplane check-keys --json
  `)
    .action(async (keys: string[], options: CheckKeysOptions) => {
      await runCommandAction(options, () => runCheckKeys(keys, options));
    });
}

async function runCheckKeys(keys: string[], options: CheckKeysOptions): Promise<void> {
  const config = loadConfig();

  if (config == null) {
    if (options.json === true) {
      outputError({ error: 'No mdplane configuration found' }, options);
      process.exit(1);
    }
    error('No mdplane configuration found.');
    info('Run "mdplane init" to create a new workspace.');
    process.exit(1);
  }

  const profile = getActiveProfile(options.profile);

  if (profile == null) {
    const profileName = options.profile ?? config.defaultProfile ?? '(unknown)';
    if (options.json === true) {
      outputError({ error: 'Profile not found', profile: profileName }, options);
      process.exit(1);
    }
    error(`Profile "${profileName}" not found.`);
    process.exit(1);
  }

  const apiUrl = getApiUrl(profile);
  const client = new ApiClient({ baseUrl: apiUrl });

  // If no keys provided, use configured keys from profile
  let keysToCheck = keys;
  if (keysToCheck.length === 0) {
    const configuredKeys = getCapabilityKeys(profile);
    keysToCheck = [
      configuredKeys.readKey,
      configuredKeys.appendKey,
      configuredKeys.writeKey,
    ]
      .map((key) => {
        if (key == null || key === '') return undefined;
        return extractKeyFromUrl(key) ?? key;
      })
      .filter((k): k is string => k != null && k !== '');

    if (keysToCheck.length === 0) {
      if (options.json === true) {
        outputError({ error: 'No keys to check. Provide keys as arguments or configure capability URLs.' }, options);
        process.exit(1);
      }
      error('No keys to check.');
      info('Provide keys as arguments or configure capability URLs in your profile.');
      process.exit(1);
    }
  }

  // Call the API
  const response = await client.checkCapabilities(keysToCheck);

  const outputData = {
    checked: keysToCheck.length,
    results: response.results,
    summary: {
      valid: response.results.filter(r => r.valid).length,
      invalid: response.results.filter(r => !r.valid).length,
    },
  };

  output({
    data: outputData,
    options,
    formatter: () => {
      header('Capability Key Check');
      console.log();

      for (const result of response.results) {
        formatResult(result);
      }

      console.log();
      const validCount = response.results.filter(r => r.valid).length;
      const invalidCount = response.results.filter(r => !r.valid).length;

      if (invalidCount === 0) {
        success(`All ${String(validCount)} key(s) are valid`);
      } else if (validCount === 0) {
        error(`All ${String(invalidCount)} key(s) are invalid`);
      } else {
        info(`${String(validCount)} valid, ${String(invalidCount)} invalid`);
      }
    },
  });

  // Exit with error if any keys are invalid
  if (response.results.some(r => !r.valid)) {
    process.exit(1);
  }
}

function formatResult(result: CapabilityCheckResult): void {
  const keyDisplay = maskKey(result.key);

  if (result.valid) {
    console.log(`  ${chalk.green('✓')} ${keyDisplay}`);
    keyValue('    Permission', result.permission ?? 'unknown');
    keyValue('    Scope', result.scope ?? 'unknown');
    if (result.scopeId != null) {
      keyValue('    Scope ID', result.scopeId);
    }
  } else {
    console.log(`  ${chalk.red('✗')} ${keyDisplay}`);
    keyValue('    Error', result.error ?? 'unknown');
  }
  console.log();
}


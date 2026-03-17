import type { Command } from 'commander';
import { ApiClient, type ApiFileRecoverResponse } from '../api.js';
import {
  success,
  info,
  keyValue,
  header,
  output,
  exitWithValidationError,
  type OutputOptions,
} from '../utils.js';
import { requireCapabilityWriteContext, runCommandAction } from './_runtime/index.js';

interface RecoverOptions extends OutputOptions {
  rotateUrls?: boolean;
  profile?: string;
}

export function registerRecoverCommand(program: Command): void {
  program
    .command('recover <path>')
    .description('Recover a deleted file')
    .option('-p, --profile <name>', 'Profile to use')
    .option('-r, --rotate-urls', 'Generate new capability URLs after recovery')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Recover a deleted file:
    $ mdplane recover /notes/deleted.md

  Recover and rotate URLs for security:
    $ mdplane recover /notes/deleted.md --rotate-urls

  Output as JSON:
    $ mdplane recover /notes/deleted.md --json
  `)
    .action(async (path: string, options: RecoverOptions) => {
      await runCommandAction(options, () => runRecover(path, options));
    });
}

async function runRecover(targetPath: string, options: RecoverOptions): Promise<void> {
  const { ctx, key: writeKey } = requireCapabilityWriteContext({
    profile: options.profile,
    options,
    unsupportedApiKeyMessage: 'File recovery via API key is not yet supported.',
    missingWriteKeyMessage: 'Write key is required to recover files.',
    missingWriteKeyHint: 'Make sure your profile contains write capability URL.',
  });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: ctx.apiKey });

  if (options.json !== true) {
    info(`Recovering ${targetPath}...`);
  }

  let result: ApiFileRecoverResponse;

  try {
    result = await client.recoverFile(writeKey, options.rotateUrls ?? false);

    const outputData = {
      id: result.id,
      path: result.path,
      recovered: result.recovered,
      urls: result.urls,
      webUrl: result.webUrl,
    };

    output({
      data: outputData,
      options,
      formatter: () => {
        header(`Recovered: ${result.path}`);
        keyValue('File ID', result.id);
        keyValue('Path', result.path);
        if (options.rotateUrls === true) {
          keyValue('Read URL', result.urls.read ?? 'N/A');
          keyValue('Append URL', result.urls.append ?? 'N/A');
          keyValue('Write URL', result.urls.write ?? 'N/A');
        }
        if (result.webUrl != null) {
          keyValue('Web', result.webUrl);
        }
        console.log();
        success('File recovered successfully!');
      },
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('not found') || err.message.includes('FILE_NOT_FOUND')) {
        exitWithValidationError({ message: `File not found or not deleted: ${targetPath}`, options });
      }
      if (err.message.includes('RECOVERY_EXPIRED')) {
        exitWithValidationError({
          message: 'Recovery window expired.',
          options,
          helpText: 'Files can only be recovered within 7 days of deletion.',
        });
      }
    }
    throw err;
  }
}


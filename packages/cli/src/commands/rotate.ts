import type { Command } from 'commander';
import { ApiClient, type ApiRotateUrlsResponse } from '../api.js';
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

interface RotateOptions extends OutputOptions {
  profile?: string;
}

export function registerRotateCommand(program: Command): void {
  program
    .command('rotate')
    .description('Rotate capability URLs (invalidates all previous URLs)')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Rotate URLs for current profile:
    $ mdplane rotate

  Output as JSON (useful for updating config):
    $ mdplane rotate --json

Security Notes:
  - All previous capability URLs will be immediately invalidated
  - Anyone with old URLs will lose access
  - Update your profile with the new URLs after rotation
  - Workspace-level keys are NOT affected (only file-scoped keys)
  `)
    .action(async (options: RotateOptions) => {
      await runCommandAction(options, () => runRotate(options));
    });
}

async function runRotate(options: RotateOptions): Promise<void> {
  const { ctx, key: writeKey } = requireCapabilityWriteContext({
    profile: options.profile,
    options,
    unsupportedApiKeyMessage: 'URL rotation is not available in API key mode.',
    missingWriteKeyMessage: 'Write key is required to rotate URLs.',
    missingWriteKeyHint: 'Make sure your profile contains write capability URL.',
  });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: ctx.apiKey });

  if (options.json !== true) {
    info('Rotating capability URLs...');
  }

  let result: ApiRotateUrlsResponse;

  try {
    result = await client.rotateUrls(writeKey);

    const outputData = {
      id: result.id,
      urls: result.urls,
      previousUrlsInvalidated: result.previousUrlsInvalidated,
      webUrl: result.webUrl,
    };

    output({
      data: outputData,
      options,
      formatter: () => {
        header('URLs Rotated Successfully');
        keyValue('File ID', result.id);
        console.log();
        info('New Capability URLs:');
        keyValue('Read URL', result.urls.read ?? 'N/A');
        keyValue('Append URL', result.urls.append ?? 'N/A');
        keyValue('Write URL', result.urls.write ?? 'N/A');
        console.log();
        if (result.webUrl != null) {
          keyValue('Web', result.webUrl);
        }
        keyValue('Previous URLs Invalidated', result.previousUrlsInvalidated.toString());
        console.log();
        success('URLs rotated! Update your profile with the new URLs.');
      },
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('not found') || err.message.includes('KEY_NOT_FOUND')) {
        exitWithValidationError({ message: 'Invalid or expired write key.', options });
      }
    }
    throw err;
  }
}


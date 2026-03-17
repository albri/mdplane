import type { Command } from 'commander';
import { ApiClient, type ApiFileSettings, type ApiFileSettingsUpdateRequest } from '../api.js';
import {
  success,
  info,
  keyValue,
  header,
  output,
  exitWithValidationError,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireCapabilityWriteContext } from './_runtime/index.js';

interface SettingsOptions extends OutputOptions {
  profile?: string;
  claimDuration?: number;
  maxAppendSize?: number;
  wipLimit?: number;
  labels?: string;
  allowedTypes?: string;
}

export function registerSettingsCommand(program: Command): void {
  program
    .command('settings')
    .description('Get or set file settings')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--claim-duration <seconds>', 'Set default claim duration in seconds', parseInt)
    .option('--max-append-size <bytes>', 'Set maximum append size in bytes', parseInt)
    .option('--wip-limit <n>', 'Set work-in-progress limit for claims', parseInt)
    .option('--labels <labels>', 'Set allowed labels (comma-separated)')
    .option('--allowed-types <types>', 'Set allowed append types (comma-separated)')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Get current file settings:
    $ mdplane settings

  Set claim duration to 10 minutes:
    $ mdplane settings --claim-duration 600

  Set WIP limit and labels:
    $ mdplane settings --wip-limit 5 --labels "bug,feature,refactor"

  Set allowed append types:
    $ mdplane settings --allowed-types "task,claim,response"

  Output as JSON:
    $ mdplane settings --json
  `)
    .action(async (options: SettingsOptions) => {
      await runCommandAction(options, () => runSettings(options));
    });
}

async function runSettings(options: SettingsOptions): Promise<void> {
  const { ctx, key: writeKey } = requireCapabilityWriteContext({
    profile: options.profile,
    options,
    unsupportedApiKeyMessage: 'File settings via API key is not yet supported.',
    missingWriteKeyMessage: 'Write key is required to access file settings.',
    missingWriteKeyHint: 'Make sure your profile contains write capability URL.',
  });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: ctx.apiKey });

  const hasUpdates = options.claimDuration != null ||
    options.maxAppendSize != null ||
    options.wipLimit != null ||
    options.labels != null ||
    options.allowedTypes != null;

  try {
    let result: ApiFileSettings;

    if (hasUpdates) {
      const updateRequest: ApiFileSettingsUpdateRequest = {};
      if (options.claimDuration != null) updateRequest.claimDurationSeconds = options.claimDuration;
      if (options.maxAppendSize != null) updateRequest.maxAppendSize = options.maxAppendSize;
      if (options.wipLimit != null) updateRequest.wipLimit = options.wipLimit;
      if (options.labels != null) updateRequest.labels = options.labels.split(',').map(l => l.trim());
      if (options.allowedTypes != null) {
        const types = options.allowedTypes.split(',').map(t => t.trim());
        updateRequest.allowedAppendTypes = types as ('task' | 'claim' | 'response' | 'comment' | 'blocked' | 'answer' | 'renew' | 'cancel' | 'vote')[];
      }

      if (options.json !== true) {
        info('Updating file settings...');
      }
      result = await client.updateFileSettings(writeKey, updateRequest);
    } else {
      if (options.json !== true) {
        info('Getting file settings...');
      }
      result = await client.getFileSettings(writeKey);
    }

    output({
      data: result,
      options,
      formatter: () => {
        header('File Settings');
        if (result.claimDurationSeconds != null) keyValue('Claim Duration', `${result.claimDurationSeconds.toString()}s`);
        if (result.maxAppendSize != null) keyValue('Max Append Size', `${result.maxAppendSize.toString()} bytes`);
        if (result.wipLimit != null) keyValue('WIP Limit', result.wipLimit.toString());
        if (result.allowedAppendTypes != null && result.allowedAppendTypes.length > 0) {
          keyValue('Allowed Types', result.allowedAppendTypes.join(', '));
        }
        if (result.labels != null && result.labels.length > 0) {
          keyValue('Labels', result.labels.join(', '));
        }
        console.log();
        if (hasUpdates) {
          success('Settings updated!');
        }
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      exitWithValidationError({ message: 'File not found.', options });
    }
    throw err;
  }
}


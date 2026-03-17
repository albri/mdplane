import type { Command } from 'commander';
import { ApiClient, type ApiFileMoveResponse } from '../api.js';
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

interface MvOptions extends OutputOptions {
  profile?: string;
}

export function registerMvCommand(program: Command): void {
  program
    .command('mv <source> <destination>')
    .description('Move file to a different folder')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Move a file to another folder:
    $ mdplane mv /notes/old.md /archive/

  Move to root folder:
    $ mdplane mv /notes/file.md /

  Output as JSON:
    $ mdplane mv /notes/old.md /archive/ --json

Note:
  To rename a file (change name only), use:
    $ mdplane write /notes/new-name.md --rename-from /notes/old-name.md
  `)
    .action(async (source: string, destination: string, options: MvOptions) => {
      await runCommandAction(options, () => runMv({ source, destination, options }));
    });
}

async function runMv(opts: {
  source: string;
  destination: string;
  options: MvOptions;
}): Promise<void> {
  const { source, destination, options } = opts;
  const { ctx, key: writeKey } = requireCapabilityWriteContext({
    profile: options.profile,
    options,
    unsupportedApiKeyMessage: 'File move via API key is not yet supported.',
    missingWriteKeyMessage: 'Write key is required to move files.',
    missingWriteKeyHint: 'Make sure your profile contains write capability URL.',
  });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: ctx.apiKey });

  if (options.json !== true) {
    info(`Moving ${source} to ${destination}...`);
  }

  let result: ApiFileMoveResponse;

  try {
    result = await client.moveFile({ writeKey, source, destination });

    const outputData = {
      id: result.id,
      previousPath: result.previousPath,
      newPath: result.newPath,
    };

    output({
      data: outputData,
      options,
      formatter: () => {
        header('File Moved');
        keyValue('Previous Path', result.previousPath);
        keyValue('New Path', result.newPath);
        console.log();
        success('File moved successfully!');
      },
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('not found') || err.message.includes('FILE_NOT_FOUND')) {
        exitWithValidationError({ message: `Source file not found: ${source}`, options });
      }
      if (err.message.includes('FOLDER_NOT_FOUND')) {
        exitWithValidationError({ message: `Destination folder not found: ${destination}`, options });
      }
      if (err.message.includes('FILE_EXISTS')) {
        exitWithValidationError({ message: 'A file with the same name already exists in the destination.', options });
      }
    }
    throw err;
  }
}


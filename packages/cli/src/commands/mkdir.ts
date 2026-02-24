import type { Command } from 'commander';
import { ApiClient, type ApiFolderCreateResponse } from '../api.js';
import {
  success,
  info,
  keyValue,
  header,
  output,
  exitWithValidationError,
  formatTimestamp,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireContextWithMode } from './_runtime/index.js';

interface MkdirOptions extends OutputOptions {
  profile?: string;
}

export function registerMkdirCommand(program: Command): void {
  program
    .command('mkdir <path>')
    .description('Create folder')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Create a folder at root:
    $ mdplane mkdir /notes

  Create a nested folder:
    $ mdplane mkdir /projects/alpha/docs

  Output as JSON:
    $ mdplane mkdir /notes --json
  `)
    .action(async (path: string, options: MkdirOptions) => {
      await runCommandAction(options, () => runMkdir(path, options));
    });
}

async function runMkdir(folderPath: string, options: MkdirOptions): Promise<void> {
  const { ctx, key: writeKey, mode } = requireContextWithMode({
    profile: options.profile,
    options,
    capability: 'write',
    errorMessage: 'Write key is required to create folders.',
    hint: 'Make sure your profile contains write capability URL or API key.',
  });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: ctx.apiKey });

  if (options.json !== true) {
    info(`Creating folder: ${folderPath}...`);
  }

  const parts = folderPath.split('/').filter((p) => p !== '');
  if (parts.length === 0) {
    exitWithValidationError({ message: 'Invalid folder path', options });
  }

  const folderName = parts.at(-1) ?? '';
  const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : undefined;

  let result: ApiFolderCreateResponse;

  try {
    if (mode === 'api-key') {
      result = await client.createFolder(parentPath, folderName);
    } else {
      result = await client.createFolderViaCapability({
        writeKey,
        name: folderName,
        ...(parentPath != null ? { parentPath } : {}),
      });
    }

    const outputData = {
      path: result.path,
      createdAt: result.createdAt,
    };

    output({
      data: outputData,
      options,
      formatter: () => {
        header(`Folder created: ${folderName}`);
        keyValue('Path', result.path);
        keyValue('Created', formatTimestamp(result.createdAt));
        console.log();
        success('Folder created successfully!');
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      exitWithValidationError({ message: `Folder already exists: ${folderPath}`, options });
    }
    throw err;
  }
}

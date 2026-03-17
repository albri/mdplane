import type { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api.js';
import {
  info,
  header,
  output,
  formatBytes,
  formatTimestamp,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireContextAndKey } from './_runtime/index.js';

interface FilesOptions extends OutputOptions {
  path?: string;
  profile?: string;
  sort?: 'name' | 'modified' | 'size';
  order?: 'asc' | 'desc';
}

export function registerFilesCommand(program: Command): void {
  program
    .command('files')
    .description('List files in workspace')
    .option('-p, --profile <name>', 'Profile to use')
    .option('-f, --path <path>', 'Folder path to list')
    .option('-s, --sort <field>', 'Sort by field: name, modified, size (default: name)')
    .option('-o, --order <direction>', 'Sort order: asc, desc (default: asc)')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  List all files:
    $ mdplane files

  List files in a specific folder:
    $ mdplane files --path /projects

  Sort by modification time (newest first):
    $ mdplane files --sort modified --order desc

  Sort by size (largest first):
    $ mdplane files --sort size --order desc

  Output as JSON:
    $ mdplane files --json
  `)
    .action(async (options: FilesOptions) => {
      await runCommandAction(options, () => runFiles(options));
    });
}

export function registerLsCommand(program: Command): void {
  program
    .command('ls')
    .description('List files in workspace (alias for files)')
    .option('-p, --profile <name>', 'Profile to use')
    .option('-f, --path <path>', 'Folder path to list')
    .option('-s, --sort <field>', 'Sort by field: name, modified, size (default: name)')
    .option('-o, --order <direction>', 'Sort order: asc, desc (default: asc)')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  List all files:
    $ mdplane ls

  List files in a specific folder:
    $ mdplane ls --path /projects

  Sort by modification time (newest first):
    $ mdplane ls --sort modified --order desc

  Sort by size (largest first):
    $ mdplane ls --sort size --order desc

  Output as JSON:
    $ mdplane ls --json
  `)
    .action(async (options: FilesOptions) => {
      await runCommandAction(options, () => runFiles(options));
    });
}

async function runFiles(options: FilesOptions): Promise<void> {
  const { ctx, key: readKey } = requireContextAndKey({
    profile: options.profile,
    options,
    capability: 'read',
    errorMessage: 'Read key is required to list files.',
    hint: 'Make sure your profile contains read capability URL.',
  });

  const client = new ApiClient({ baseUrl: ctx.apiUrl });

  if (options.json !== true) {
    info(`Listing files${options.path != null && options.path !== '' ? ` in ${options.path}` : ''}...`);
  }

  const listOptions: { sort?: 'name' | 'modified' | 'size'; order?: 'asc' | 'desc' } = {};
  if (options.sort) listOptions.sort = options.sort;
  if (options.order) listOptions.order = options.order;

  const result = await client.listFolder(readKey, options.path, listOptions);

  const folders = result.items.filter(item => item.type === 'folder');
  const files = result.items.filter(item => item.type === 'file');

  const outputData = {
    path: result.path,
    items: result.items,
    folders,
    files,
    totalFolders: folders.length,
    totalFiles: files.length,
  };

  output({
    data: outputData,
    options,
    formatter: () => {
      header(`Contents of ${result.path || '/'}`);

      if (folders.length === 0 && files.length === 0) {
        info('This folder is empty.');
        return;
      }

      if (folders.length > 0) {
        console.log();
        console.log(chalk.bold('Folders:'));
        for (const folder of folders) {
          console.log(`  ${chalk.blue('📁')} ${folder.name}/`);
        }
      }

      if (files.length > 0) {
        console.log();
        console.log(chalk.bold('Files:'));
        for (const file of files) {
          const size = formatBytes(file.size ?? 0);
          const modified = formatTimestamp(file.updatedAt ?? '');
          console.log(
            `  ${chalk.gray('📄')} ${file.name}  ${chalk.gray(`${size}  ${modified}`)}`
          );
        }
      }

      console.log();
      info(`${folders.length.toString()} folder(s), ${files.length.toString()} file(s)`);
    },
  });
}

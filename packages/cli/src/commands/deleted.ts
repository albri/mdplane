import type { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api.js';
import {
  info,
  header,
  output,
  formatBytes,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireApiKey, parseBoundedIntOption } from './_runtime/index.js';

interface DeletedOptions extends OutputOptions {
  limit?: string;
  cursor?: string;
  profile?: string;
}

export function registerDeletedCommand(program: Command): void {
  program
    .command('deleted')
    .description('List soft-deleted files that can be recovered')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--limit <number>', 'Maximum number of results (default: 50, max: 200)', '50')
    .option('--cursor <cursor>', 'Pagination cursor for next page')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  List deleted files:
    $ mdplane deleted

  Limit results:
    $ mdplane deleted --limit 10

  Output as JSON:
    $ mdplane deleted --json

  Recover a deleted file:
    $ mdplane recover /path/to/deleted/file.md
  `)
    .action(async (options: DeletedOptions) => {
      await runCommandAction(options, () => runDeleted(options));
    });
}

async function runDeleted(options: DeletedOptions): Promise<void> {
  const { ctx, key } = requireApiKey({ profile: options.profile, options, errorMessage: 'API key is required for deleted command.' });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: key });

  const limit = parseBoundedIntOption({
    value: options.limit,
    defaultValue: 50,
    min: 1,
    max: 200,
    optionName: 'Limit',
    options,
  });

  const requestOptions: { limit?: number; cursor?: string } = { limit };
  if (options.cursor != null) {
    requestOptions.cursor = options.cursor;
  }
  const result = await client.getDeletedFiles(requestOptions);

  output({
    data: result,
    options,
    formatter: () => {
      header('Deleted Files');

      if (result.files.length === 0) {
        info('No recoverable deleted files found.');
        info('Files are recoverable for 7 days after deletion.');
        return;
      }

      console.log();

      for (const file of result.files) {
        const expiresDate = new Date(file.expiresAt);
        const now = new Date();
        const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const daysLeftText = daysLeft <= 1 ? chalk.red(`${daysLeft.toString()}d left`) : chalk.yellow(`${daysLeft.toString()}d left`);

        console.log(`🗑️  ${chalk.bold(file.path)}`);
        console.log(`   ${chalk.gray('ID:')} ${file.id}`);
        console.log(`   ${chalk.gray('Deleted:')} ${file.deletedAt}${file.deletedBy != null ? ` by ${file.deletedBy}` : ''}`);
        console.log(`   ${chalk.gray('Expires:')} ${file.expiresAt} (${daysLeftText})`);
        console.log(`   ${chalk.gray('Size:')} ${formatBytes(file.size ?? 0)}`);
        console.log();
      }

      console.log(chalk.gray('─'.repeat(40)));
      const total = result.pagination?.total ?? result.files.length;
      info(`${total.toString()} deleted file(s)`);

      if (result.pagination?.hasMore === true) {
        console.log();
        info('More results available. Use --cursor to paginate.');
        if (result.pagination.cursor != null) {
          console.log(`  ${chalk.cyan(`mdplane deleted --cursor ${result.pagination.cursor}`)}`);
        }
      }

      console.log();
      info('To recover a file, run:');
      console.log(`  ${chalk.cyan('mdplane recover /path/to/file.md')}`);
    },
  });
}


import type { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api.js';
import {
  error,
  info,
  success,
  header,
  output,
  formatBytes,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireApiKey } from './_runtime/index.js';

interface ExportStatusOptions extends OutputOptions {
  profile?: string;
}

export function registerExportStatusCommand(program: Command): void {
  program
    .command('export-status <jobId>')
    .description('Check status of an async export job')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Check export job status:
    $ mdplane export-status abc123def456

  Output as JSON:
    $ mdplane export-status abc123def456 --json
  `)
    .action(async (jobId: string, options: ExportStatusOptions) => {
      await runCommandAction(options, () => runExportStatus(jobId, options));
    });
}

async function runExportStatus(jobId: string, options: ExportStatusOptions): Promise<void> {
  const { ctx, key } = requireApiKey({ profile: options.profile, options, errorMessage: 'API key is required to check export status.' });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: key });

  if (options.json !== true) {
    info(`Checking export job ${jobId}...`);
  }

  const status = await client.getExportJobStatus(jobId);

  output({
    data: status,
    options,
    formatter: () => {
      header(`Export Job Status: ${jobId}`);

      const statusEmoji = getStatusEmoji(status.status);
      console.log(`Status: ${statusEmoji} ${status.status}`);

      if (status.startedAt != null) {
        info(`Started: ${status.startedAt}`);
      }

      if (status.progress != null) {
        console.log();
        info(`Progress: ${String(status.progress.filesProcessed)}/${String(status.progress.totalFiles)} files`);
        info(`Bytes written: ${status.progress.bytesWritten ?? 'unknown'}`);
      }

      if (status.status === 'ready') {
        console.log();
        success('Export is ready for download!');
        console.log();
        info('Download with:');
        console.log(`  ${chalk.cyan(`mdplane export-download ${jobId}`)}`);
        console.log();
        if (status.size != null) {
          info(`Size: ${formatBytes(parseInt(status.size, 10))}`);
        }
        if (status.checksum != null) {
          info(`SHA-256: ${status.checksum}`);
        }
        if (status.expiresAt != null) {
          info(`Expires: ${status.expiresAt}`);
        }
      } else if (status.status === 'failed') {
        console.log();
        error('Export failed');
        if (status.error != null) {
          console.log(`  ${chalk.red(status.error.code ?? 'ERROR')}: ${status.error.message ?? 'Unknown error'}`);
        }
      } else if (status.status === 'expired') {
        console.log();
        error('Export has expired');
        info('Download links are only available for 24 hours after export completes.');
      }
    },
  });
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'queued':
      return '⏳';
    case 'processing':
      return '⚙️';
    case 'ready':
      return '✅';
    case 'failed':
      return '❌';
    case 'expired':
      return '⏰';
    default:
      return '•';
  }
}

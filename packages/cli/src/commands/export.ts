import type { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api.js';
import {
  info,
  success,
  header,
  output,
  formatBytes,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireApiKey } from './_runtime/index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ExportOptions extends OutputOptions {
  format?: string;
  includeAppends?: boolean;
  includeDeleted?: boolean;
  paths?: string;
  output?: string;
  async?: boolean;
  notifyEmail?: string;
  profile?: string;
}

export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Export workspace data')
    .option('-p, --profile <name>', 'Profile to use')
    .option('-f, --format <format>', 'Archive format (zip, tar.gz)', 'zip')
    .option('--include-appends', 'Include append history in metadata')
    .option('--include-deleted', 'Include soft-deleted files')
    .option('--paths <paths>', 'Comma-separated folder paths to export')
    .option('-o, --output <file>', 'Output file path (auto-generated if omitted)')
    .option('--async', 'Use async export for large workspaces')
    .option('--notify-email <email>', 'Email to notify when async export is ready')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Synchronous export (small workspaces):
    $ mdplane export

  Async export (large workspaces):
    $ mdplane export --async --notify-email user@example.com

  Export specific folders:
    $ mdplane export --paths /notes,/projects

  Include append history:
    $ mdplane export --include-appends

  Output as JSON:
    $ mdplane export --json
  `)
    .action(async (options: ExportOptions) => {
      await runCommandAction(options, () => runExport(options));
    });
}

async function runExport(options: ExportOptions): Promise<void> {
  const { ctx, key } = requireApiKey({ profile: options.profile, options, errorMessage: 'API key is required for export.' });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: key });

  const format = options.format === 'tar.gz' ? 'tar.gz' : 'zip';

  if (options.async === true) {
    await runAsyncExport({ client, options, format });
  } else {
    await runSyncExport({ client, options, format });
  }
}

async function runSyncExport(opts: {
  client: ApiClient;
  options: ExportOptions;
  format: 'zip' | 'tar.gz';
}): Promise<void> {
  const { client, options, format } = opts;
  if (options.json !== true) {
    info('Exporting workspace (synchronous)...');
  }

  const exportOptions: {
    format: 'zip' | 'tar.gz';
    includeAppends?: boolean;
    includeDeleted?: boolean;
    paths?: string;
  } = {
    format,
  };

  if (options.includeAppends != null) {
    exportOptions.includeAppends = options.includeAppends;
  }
  if (options.includeDeleted != null) {
    exportOptions.includeDeleted = options.includeDeleted;
  }
  if (options.paths != null) {
    exportOptions.paths = options.paths;
  }

  const result = await client.exportWorkspace(exportOptions);

  const outputPath = options.output ?? generateOutputPath(format);
  const buffer = await result.blob.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);

  fs.writeFileSync(outputPath, uint8Array);

  const size = formatBytes(result.blob.size);

  output({
    data: {
      outputPath,
      size,
      format,
      checksum: result.checksum,
      includeAppends: options.includeAppends ?? false,
      includeDeleted: options.includeDeleted ?? false,
      paths: options.paths ?? null,
    },
    options,
    formatter: () => {
      header('Export Complete');
      success(`Export saved to ${outputPath}`);
      info(`Size: ${size}`);
      if (result.checksum != null) {
        info(`SHA-256: ${result.checksum}`);
      }
    },
  });
}

async function runAsyncExport(opts: {
  client: ApiClient;
  options: ExportOptions;
  format: 'zip' | 'tar.gz';
}): Promise<void> {
  const { client, options, format } = opts;
  if (options.json !== true) {
    info('Creating export job (asynchronous)...');
  }

  const paths = options.paths != null ? options.paths.split(',').map((p) => p.trim()) : undefined;

  const jobOptions: {
    format: 'zip' | 'tar.gz';
    includeAppends?: boolean;
    includeDeleted?: boolean;
    paths?: string[];
    notifyEmail?: string;
  } = {
    format,
  };

  if (options.includeAppends != null) {
    jobOptions.includeAppends = options.includeAppends;
  }
  if (options.includeDeleted != null) {
    jobOptions.includeDeleted = options.includeDeleted;
  }
  if (paths != null) {
    jobOptions.paths = paths;
  }
  if (options.notifyEmail != null) {
    jobOptions.notifyEmail = options.notifyEmail;
  }

  const job = await client.createExportJob(jobOptions);

  output({
    data: {
      jobId: job.jobId,
      status: job.status,
      statusUrl: job.statusUrl,
      estimatedSize: job.estimatedSize,
      position: job.position,
      format,
      includeAppends: options.includeAppends ?? false,
      includeDeleted: options.includeDeleted ?? false,
      paths: paths ?? null,
      notifyEmail: options.notifyEmail ?? null,
    },
    options,
    formatter: () => {
      header('Export Job Created');
      success(`Job ID: ${job.jobId}`);
      info(`Status: ${job.status}`);
      if (job.estimatedSize != null) {
        info(`Estimated size: ${job.estimatedSize}`);
      }
      if (job.position != null) {
        info(`Queue position: ${String(job.position)}`);
      }
      if (job.statusUrl) {
        console.log();
        info('Check status with:');
        console.log(`  ${chalk.cyan(`mdplane export-status ${job.jobId}`)}`);
      }
      if (options.notifyEmail != null) {
        info(`Notification will be sent to ${options.notifyEmail}`);
      }
    },
  });
}

function generateOutputPath(format: 'zip' | 'tar.gz'): string {
  const date = new Date();
  const timestamp = date.toISOString().split('T')[0] ?? '';
  const ext = format === 'tar.gz' ? 'tar.gz' : 'zip';
  return path.join(process.cwd(), `workspace-export-${timestamp}.${ext}`);
}

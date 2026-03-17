import type { Command } from 'commander';
import { ApiClient } from '../api.js';
import {
  success,
  info,
  header,
  output,
  formatBytes,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireApiKey } from './_runtime/index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ExportDownloadOptions extends OutputOptions {
  output?: string;
  profile?: string;
}

export function registerExportDownloadCommand(program: Command): void {
  program
    .command('export-download <jobId>')
    .description('Download completed export archive')
    .option('-p, --profile <name>', 'Profile to use')
    .option('-o, --output <file>', 'Output file path (auto-generated if omitted)')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Download completed export:
    $ mdplane export-download abc123def456

  Download to specific file:
    $ mdplane export-download abc123def456 -o my-export.zip

  Output as JSON:
    $ mdplane export-download abc123def456 --json
  `)
    .action(async (jobId: string, options: ExportDownloadOptions) => {
      await runCommandAction(options, () => runExportDownload(jobId, options));
    });
}

async function runExportDownload(jobId: string, options: ExportDownloadOptions): Promise<void> {
  const { ctx, key } = requireApiKey({ profile: options.profile, options, errorMessage: 'API key is required to download export.' });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: key });

  if (options.json !== true) {
    info(`Downloading export ${jobId}...`);
  }

  const result = await client.downloadExportJob(jobId);

  const outputPath = options.output ?? generateOutputPath(jobId);
  const buffer = await result.blob.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);

  fs.writeFileSync(outputPath, uint8Array);

  const size = formatBytes(result.blob.size);

  output({
    data: {
      jobId,
      outputPath,
      size,
      checksum: result.checksum,
    },
    options,
    formatter: () => {
      header('Export Downloaded');
      success(`Export saved to ${outputPath}`);
      info(`Size: ${size}`);
      if (result.checksum != null) {
        info(`SHA-256: ${result.checksum}`);
      }
    },
  });
}

function generateOutputPath(jobId: string): string {
  const ext = 'zip';
  return path.join(process.cwd(), `export-${jobId}.${ext}`);
}

import type { Command } from 'commander';
import { ApiClient } from '../api.js';
import {
  success,
  info,
  keyValue,
  header,
  output,
  exitWithValidationError,
  readStdin,
  formatBytes,
  formatTimestamp,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireContextWithMode } from './_runtime/index.js';

interface WriteOptions extends OutputOptions {
  force?: boolean;
  stdin?: boolean;
  etag?: string;
  profile?: string;
}

export function registerWriteCommand(program: Command): void {
  program
    .command('write <path>')
    .description('Write file content')
    .argument('[content]', 'Content to write')
    .option('-p, --profile <name>', 'Profile to use')
    .option('-f, --force', 'Skip ETag check (last-write-wins)')
    .option('-e, --etag <etag>', 'ETag for optimistic concurrency')
    .option('--stdin', 'Read content from stdin')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Write a file with inline content:
    $ mdplane write /notes/ideas.md "New ideas..."

  Write from stdin:
    $ echo "Content" | mdplane write /notes/file.md --stdin

  Force write (skip ETag check):
    $ mdplane write /notes/file.md "Updated content" --force

  Write with specific ETag:
    $ mdplane write /notes/file.md "Updated content" --etag "abc123"
  `)
    .action(async (path: string, content: string | undefined, options: WriteOptions) => {
      await runCommandAction(options, () => runWrite({ filePath: path, content, options }));
    });
}

async function runWrite(opts: {
  filePath: string;
  content: string | undefined;
  options: WriteOptions;
}): Promise<void> {
  const { filePath, content, options } = opts;
  const { ctx, key: writeKey, mode } = requireContextWithMode({
    profile: options.profile,
    options,
    capability: 'write',
    errorMessage: 'Write key is required to write files.',
    hint: 'Make sure your profile contains write capability URL or API key.',
  });

  let writeContent = content;
  if (options.stdin === true) {
    writeContent = await readStdin();
  }

  if (writeContent == null || writeContent === '') {
    exitWithValidationError({
      message: 'Content is required. Provide as argument or use --stdin.',
      options,
    });
  }

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: ctx.apiKey });

  if (options.json !== true) {
    info(`Writing to ${filePath}...`);
  }

  let result;
  let etag = options.etag;

  if (options.force !== true && etag == null) {
    try {
      if (mode === 'api-key') {
        const existingFile = await client.readFileByPath(filePath);
        etag = existingFile.etag;
      } else {
        // Capability read and write endpoints expose different ETag formats on current server responses.
        // Auto-fetched ETags can fail optimistic writes, so capability mode only uses explicit --etag values.
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const normalizedError = errorMessage.toLowerCase();
      if (!normalizedError.includes('404') && !normalizedError.includes('not found')) {
        throw err;
      }
    }
  }

  if (mode === 'api-key') {
    result = await client.writeFileByPath({
      path: filePath,
      content: writeContent,
      ...(etag != null ? { etag } : {}),
    });
  } else {
    result = await client.updateFile({
      writeKey,
      path: filePath,
      content: writeContent,
      ...(etag != null ? { etag } : {}),
    });
  }

  const outputData = {
    id: result.id,
    etag: result.etag,
    updatedAt: result.updatedAt,
    size: result.size,
  };

  output({
    data: outputData,
    options,
    formatter: () => {
      header(`File: ${filePath}`);
      keyValue('ID', result.id);
      keyValue('Size', formatBytes(result.size));
      keyValue('Modified', formatTimestamp(result.updatedAt));
      keyValue('ETag', result.etag);
      console.log();
      success('File written successfully!');
    },
  });
}

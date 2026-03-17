import type { Command } from 'commander';
import { ApiClient } from '../api.js';
import {
  info,
  keyValue,
  header,
  output,
  formatBytes,
  formatTimestamp,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireContextAndKey } from './_runtime/index.js';

interface ReadOptions extends OutputOptions {
  raw?: boolean;
  meta?: boolean;
  tail?: string | boolean;
  structure?: boolean;
  section?: string;
  profile?: string;
}

export function registerReadCommand(program: Command): void {
  registerReadLikeCommand(program, {
    name: 'read',
    description: 'Read file content',
  });
}

export function registerCatCommand(program: Command): void {
  registerReadLikeCommand(program, {
    name: 'cat',
    description: 'Read file content (alias for read)',
  });
}

interface ReadLikeCommandConfig {
  name: 'read' | 'cat';
  description: string;
}

function registerReadLikeCommand(program: Command, config: ReadLikeCommandConfig): void {
  addReadOptions(program.command(`${config.name} <path>`).description(config.description))
    .addHelpText('after', getReadHelpText(config.name))
    .action(async (path: string, options: ReadOptions) => {
      await runCommandAction(options, () => runRead(path, options));
    });
}

function addReadOptions(command: Command): Command {
  return command
    .option('-p, --profile <name>', 'Profile to use')
    .option('-r, --raw', 'Output raw content only (no metadata)')
    .option('-m, --meta', 'Show metadata only (no content)')
    .option('-t, --tail [bytes]', 'Show last N bytes (default: 1024)')
    .option('-s, --structure', 'Show document structure/headings')
    .option('--section <heading>', 'Extract section by heading')
    .option('--json', 'Output as JSON');
}

function getReadHelpText(commandName: 'read' | 'cat'): string {
  return `

Examples:
  Read a file:
    $ mdplane ${commandName} /notes/README.md

  Read raw content only:
    $ mdplane ${commandName} /notes/README.md --raw

  Show metadata only:
    $ mdplane ${commandName} /notes/README.md --meta

  Show last 2KB of file:
    $ mdplane ${commandName} /notes/README.md --tail 2048

  Show document outline:
    $ mdplane ${commandName} /notes/README.md --structure

  Extract a specific section:
    $ mdplane ${commandName} /notes/README.md --section "Installation"

  Output as JSON:
    $ mdplane ${commandName} /notes/README.md --json
  `;
}

async function runRead(filePath: string, options: ReadOptions): Promise<void> {
  const { ctx, key: readKey } = requireContextAndKey({
    profile: options.profile,
    options,
    capability: 'read',
    errorMessage: 'Read key is required to read files.',
    hint: 'Make sure your profile contains read capability URL.',
  });

  const client = new ApiClient({ baseUrl: ctx.apiUrl });

  if (options.raw === true) {
    const rawContent = await client.getFileRaw(readKey);
    console.log(rawContent);
    return;
  }

  if (options.meta === true) {
    const meta = await client.getFileMeta(readKey);
    output({
      data: meta,
      options,
      formatter: () => {
        header(`File: ${meta.filename}`);
        keyValue('ID', meta.id);
        keyValue('Folder', meta.folder);
        keyValue('Size', formatBytes(meta.size));
        keyValue('Appends', String(meta.appendCount));
        keyValue('Created', formatTimestamp(meta.createdAt));
        keyValue('Modified', formatTimestamp(meta.updatedAt));
        keyValue('Tasks', `${String(meta.taskStats.pending)} pending, ${String(meta.taskStats.claimed)} claimed, ${String(meta.taskStats.completed)} completed`);
        keyValue('Webhook', meta.hasWebhook ? 'Yes' : 'No');
      },
    });
    return;
  }

  if (options.tail != null) {
    const bytes = typeof options.tail === 'string' ? parseInt(options.tail, 10) : 1024;
    const tail = await client.getFileTail(readKey, { bytes });
    output({
      data: tail,
      options,
      formatter: () => {
        if (tail.truncated) {
          info(`Showing last ${formatBytes(tail.bytesReturned)} (file truncated)`);
        }
        console.log(tail.content);
      },
    });
    return;
  }

  if (options.structure === true) {
    const structure = await client.getFileStructure(readKey);
    output({
      data: structure,
      options,
      formatter: () => {
        header('Document Structure');
        keyValue('Append Count', String(structure.appendCount));
        keyValue('Has Tasks', structure.hasTaskAppends ? 'Yes' : 'No');
        console.log();
        if (structure.headings.length === 0) {
          info('No headings found');
        } else {
          for (const h of structure.headings) {
            const indent = '  '.repeat(h.level - 1);
            console.log(`${indent}${'#'.repeat(h.level)} ${h.text} (line ${String(h.line)})`);
          }
        }
      },
    });
    return;
  }

  if (options.section != null) {
    const section = await client.getFileSection(readKey, options.section);
    output({
      data: section,
      options,
      formatter: () => {
        header(`Section: ${section.heading}`);
        keyValue('Level', String(section.level));
        keyValue('Lines', `${String(section.startLine)}-${String(section.endLine)}`);
        console.log();
        console.log(section.content);
      },
    });
    return;
  }

  const result = await client.getFile(readKey, filePath);

  const outputData = {
    id: result.id,
    filename: result.filename,
    content: result.content,
    size: result.size,
    appendCount: result.appendCount,
    etag: result.etag,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };

  output({
    data: outputData,
    options,
    formatter: () => {
      header(`File: ${result.filename}`);
      keyValue('Size', formatBytes(result.size));
      keyValue('Appends', String(result.appendCount));
      keyValue('Modified', formatTimestamp(result.updatedAt));
      console.log();
      console.log(result.content);
    },
  });
}

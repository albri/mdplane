import type { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient, type SearchResponse } from '../api.js';
import {
  info,
  header,
  output,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, parseBoundedIntOption, requireContextWithMode } from './_runtime/index.js';

interface SearchOptions extends OutputOptions {
  type?: string;
  path?: string;
  status?: string;
  author?: string;
  labels?: string;
  priority?: string;
  since?: string;
  limit?: string;
  profile?: string;
}

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search workspace for content')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--type <type>', 'Filter by append type (task, claim, response, comment, etc.)')
    .option('--path <path>', 'Limit search to a specific folder path')
    .option('--status <status>', 'Filter by task status (pending, claimed, completed, cancelled)')
    .option('--author <author>', 'Filter by author name')
    .option('--labels <labels>', 'Filter by labels (comma-separated, OR matching)')
    .option('--priority <priority>', 'Filter by priority levels (comma-separated)')
    .option('--since <timestamp>', 'Return results after this timestamp (ISO 8601)')
    .option('--limit <number>', 'Maximum number of results to return (default: 50, max: 200)', '50')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Authentication:
  - With API key: searches entire workspace (supports --path filtering)
  - With read key only: searches scope determined by the capability key

Examples:
  Search for content (API key mode):
    $ mdplane search "AI agents"

  Search in specific folder (API key mode only):
    $ mdplane search "bugs" --path /projects/alpha

  Search for tasks:
    $ mdplane search "implement" --type task --status pending

  Search with read key (scoped search):
    $ mdplane search "notes" --profile my-readonly-profile

  Search with limit:
    $ mdplane search "API" --limit 10

  Output as JSON:
    $ mdplane search "design" --json
  `)
    .action(async (query: string, options: SearchOptions) => {
      await runCommandAction(options, () => runSearch(query, options));
    });
}

async function runSearch(query: string, options: SearchOptions): Promise<void> {
  const { ctx, key, mode } = requireContextWithMode({
    profile: options.profile,
    options,
    capability: 'read',
    errorMessage: 'API key or read key is required for search.',
    hint: 'Make sure your profile contains an API key (for workspace-wide search) or a read key (for scoped search).',
  });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: mode === 'api-key' ? ctx.apiKey : undefined });

  if (options.json !== true) {
    const modeLabel = mode === 'api-key' ? 'workspace-wide' : 'scoped (via read key)';
    info(`Searching for "${query}" [${modeLabel}]...`);
  }

  const limit = parseBoundedIntOption({
    value: options.limit,
    defaultValue: 50,
    min: 1,
    max: 200,
    optionName: 'Limit',
    options,
  });

  let result: SearchResponse;
  if (mode === 'api-key') {
    const searchOptions: {
      type?: string;
      folder?: string;
      status?: string;
      author?: string;
      labels?: string;
      priority?: string;
      since?: string;
      limit?: number;
    } = { limit };
    if (options.type != null) searchOptions.type = options.type;
    if (options.path != null) searchOptions.folder = options.path;
    if (options.status != null) searchOptions.status = options.status;
    if (options.author != null) searchOptions.author = options.author;
    if (options.labels != null) searchOptions.labels = options.labels;
    if (options.priority != null) searchOptions.priority = options.priority;
    if (options.since != null) searchOptions.since = options.since;
    result = await client.searchWorkspace(query, searchOptions);
  } else {
    const capabilityOptions: {
      type?: string;
      status?: string;
      author?: string;
      labels?: string;
      priority?: string;
      since?: string;
      limit?: number;
    } = { limit };
    if (options.type != null) capabilityOptions.type = options.type;
    if (options.status != null) capabilityOptions.status = options.status;
    if (options.author != null) capabilityOptions.author = options.author;
    if (options.labels != null) capabilityOptions.labels = options.labels;
    if (options.priority != null) capabilityOptions.priority = options.priority;
    if (options.since != null) capabilityOptions.since = options.since;
    result = await client.searchViaCapability(key, query, capabilityOptions);
  }

  output({
    data: result,
    options,
    formatter: () => {
      header('Search Results');

      if (result.results.length === 0) {
        info('No results found.');
        return;
      }

      for (const item of result.results) {
        console.log();
        const typeEmoji = getTypeEmoji(item.type);
        const score = typeof item.score === 'number' ? chalk.gray(` (${item.score.toFixed(2)})`) : '';

        console.log(`${typeEmoji} ${chalk.bold(item.content.substring(0, 100))}${score}`);

        if (item.file != null) {
          console.log(`  ${chalk.gray('📄')} ${item.file.path}`);
        }

        console.log(`  ${chalk.gray('ID:')} ${item.id}`);

        if (item.highlights.length > 0) {
          // Non-null assertion safe: we checked length > 0
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const highlight = item.highlights[0]!;
          const before = item.content.substring(0, highlight.start);
          const match = item.content.substring(highlight.start, highlight.end);
          const after = item.content.substring(highlight.end);
          console.log(`  ${chalk.gray('Highlight:')} ${before}${chalk.yellow(match)}${after.substring(0, 50)}...`);
        }
      }

      console.log();
      console.log(chalk.gray('─'.repeat(40)));
      info(`${(result.total ?? result.results.length).toString()} result(s) found${result.pagination?.hasMore === true ? ' (more results available)' : ''}`);
    },
  });
}

function getTypeEmoji(type: string): string {
  switch (type) {
    case 'file':
      return '📄';
    case 'task':
      return '✅';
    case 'claim':
      return '🎯';
    case 'response':
      return '💬';
    case 'blocked':
      return '🚫';
    case 'answer':
      return '✓';
    case 'renew':
      return '🔄';
    case 'cancel':
      return '❌';
    case 'comment':
      return '💭';
    case 'vote':
      return '🗳️';
    default:
      return '•';
  }
}

import type { Command } from 'commander';
import type { UserAppendType } from '@mdplane/shared';
import { USER_APPEND_TYPES, PRIORITIES } from '@mdplane/shared';
import { ApiClient } from '../api.js';
import {
  success,
  keyValue,
  header,
  output,
  exitWithValidationError,
  readStdin,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireContextAndKey } from './_runtime/index.js';

interface AppendOptions extends OutputOptions {
  type?: string;
  author?: string;
  ref?: string;
  stdin?: boolean;
  profile?: string;
  priority?: string;
  labels?: string;
  due?: string;
  value?: string;
}

function isValidAppendType(type: string): type is UserAppendType {
  return (USER_APPEND_TYPES as readonly string[]).includes(type);
}

export function registerAppendCommand(program: Command): void {
  program
    .command('append <path>')
    .description('Append content to a file')
    .argument('[content]', 'Content to append')
    .option('-p, --profile <name>', 'Profile to use')
    .option('-t, --type <type>', 'Append type (task, comment, claim, etc.)', 'comment')
    .option('-a, --author <author>', 'Author name', 'cli')
    .option('-r, --ref <ref>', 'Reference to another append ID')
    .option('--priority <priority>', 'Task priority (low, medium, high, critical)')
    .option('--labels <labels>', 'Comma-separated labels (tasks only)')
    .option('--due <date>', 'Due date in ISO 8601 format (tasks only)')
    .option('--value <value>', 'Vote value (+1 or -1, votes only)')
    .option('--stdin', 'Read content from stdin')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Append a comment:
    $ mdplane append /notes/tasks.md "Fix the bug"

  Append a task:
    $ mdplane append /notes/tasks.md "Implement feature" --type task

  Append a high-priority task with labels:
    $ mdplane append /notes/tasks.md "Fix critical bug" --type task --priority high --labels "bug,urgent"

  Append a task with a due date:
    $ mdplane append /notes/tasks.md "Submit report" --type task --due 2024-02-01T17:00:00Z

  Append with stdin:
    $ echo "New note" | mdplane append /notes/ideas.md --stdin

  Append with reference (complete a task):
    $ mdplane append /notes/tasks.md "Done!" --type response --ref a1

  Vote on an append:
    $ mdplane append /notes/tasks.md "" --type vote --ref a1 --value +1
  `)
    .action(async (path: string, content: string | undefined, options: AppendOptions) => {
      await runCommandAction(options, () => runAppend({ filePath: path, content, options }));
    });
}

async function runAppend(opts: {
  filePath: string;
  content: string | undefined;
  options: AppendOptions;
}): Promise<void> {
  const { content, options } = opts;
  const { ctx, key: appendKey } = requireContextAndKey({
    profile: options.profile,
    options,
    capability: 'append',
    errorMessage: 'Append key is required to append content.',
    hint: 'Make sure your profile contains append capability URL.',
  });

  const typeInput = options.type ?? 'comment';
  if (!isValidAppendType(typeInput)) {
    exitWithValidationError({
      message: `Invalid append type: ${options.type ?? 'undefined'}`,
      options,
      helpText: `Valid types: ${USER_APPEND_TYPES.join(', ')}`,
    });
  }
  const appendType = typeInput;

  let appendContent = content;
  if (options.stdin === true) {
    appendContent = await readStdin();
  }

  const contentRequired = appendType !== 'vote';
  if (contentRequired && (appendContent == null || appendContent === '')) {
    exitWithValidationError({
      message: 'Content is required. Provide as argument or use --stdin.',
      options,
    });
  }

  type Priority = (typeof PRIORITIES)[number];
  let priority: Priority | undefined;
  if (options.priority != null) {
    if (!PRIORITIES.includes(options.priority as Priority)) {
      exitWithValidationError({
        message: `Invalid priority: ${options.priority}`,
        options,
        helpText: `Valid priorities: ${PRIORITIES.join(', ')}`,
      });
    }
    priority = options.priority as Priority;
  }

  let voteValue: '+1' | '-1' | undefined;
  if (options.value != null) {
    if (options.value !== '+1' && options.value !== '-1') {
      exitWithValidationError({
        message: `Invalid vote value: ${options.value}`,
        options,
        helpText: 'Valid values: +1, -1',
      });
    }
    voteValue = options.value;
  }

  const labels = options.labels?.split(',').map((l) => l.trim()).filter((l) => l !== '');

  const client = new ApiClient({ baseUrl: ctx.apiUrl });

  const result = await client.append(appendKey, {
    path: opts.filePath,
    content: appendContent ?? '',
    type: appendType,
    author: options.author,
    ref: options.ref,
    priority,
    labels,
    dueAt: options.due,
    value: voteValue,
  });

  const outputData: Record<string, unknown> = {
    id: result.id,
    author: result.author,
    type: result.type,
    timestamp: result.ts,
  };
  if (result.ref != null) outputData.ref = result.ref;
  if (result.priority != null) outputData.priority = result.priority;
  if (result.labels != null && result.labels.length > 0) outputData.labels = result.labels;
  if (result.dueAt != null) outputData.dueAt = result.dueAt;
  if (result.expiresAt != null) outputData.expiresAt = result.expiresAt;

  output({
    data: outputData,
    options,
    formatter: () => {
      header('Append Created');
      keyValue('ID', result.id);
      keyValue('Type', result.type);
      keyValue('Author', result.author);
      if (result.ref != null && result.ref !== '') {
        keyValue('Reference', result.ref);
      }
      if (result.priority != null) {
        keyValue('Priority', result.priority);
      }
      if (result.labels != null && result.labels.length > 0) {
        keyValue('Labels', result.labels.join(', '));
      }
      if (result.dueAt != null) {
        keyValue('Due', result.dueAt);
      }
      if (result.expiresAt != null) {
        keyValue('Expires', result.expiresAt);
      }
      console.log();
      success('Content appended successfully!');
    },
  });
}

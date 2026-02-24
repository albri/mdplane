#!/usr/bin/env node

import { Command } from 'commander';
import { renderAsciiWordmark } from './utils.js';
import { registerAllCommands } from './commands/index.js';

const program = new Command();

program
  .name('mdplane')
  .description('Command-line interface for mdplane - markdown-based coordination for AI agents')
  .version('0.1.0')
  .addHelpText('beforeAll', renderAsciiWordmark() + '\n')
  .addHelpText('after', `

Examples:
  Initialize a new workspace:
    $ mdplane init --api-key sk_live_...

  List files in workspace:
    $ mdplane ls
    $ mdplane files --json

  Read a file:
    $ mdplane cat /notes/README.md

  Write a file:
    $ mdplane write /notes/ideas.md "New ideas..."

  Append to a file:
    $ mdplane append /notes/tasks.md "- [ ] Implement feature"

  Search workspace:
    $ mdplane search "AI agents" --limit 20
  `);

registerAllCommands(program);

program.parse();


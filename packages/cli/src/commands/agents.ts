import type { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api.js';
import {
  info,
  header,
  output,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireApiKey, parseBoundedIntOption } from './_runtime/index.js';

interface AgentsOptions extends OutputOptions {
  staleThreshold?: string;
  folder?: string;
  profile?: string;
}

export function registerAgentsCommand(program: Command): void {
  program
    .command('agents')
    .description('List active agents and their liveness status')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--stale-threshold <seconds>', 'Seconds before agent is considered stale (default: 300)', '300')
    .option('--folder <path>', 'Filter to agents active in a specific folder')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  List all agents:
    $ mdplane agents

  Custom stale threshold (10 minutes):
    $ mdplane agents --stale-threshold 600

  Filter by folder:
    $ mdplane agents --folder /projects

  Output as JSON:
    $ mdplane agents --json
  `)
    .action(async (options: AgentsOptions) => {
      await runCommandAction(options, () => runAgents(options));
    });
}

async function runAgents(options: AgentsOptions): Promise<void> {
  const { ctx, key } = requireApiKey({ profile: options.profile, options, errorMessage: 'API key is required for agents command.' });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: key });

  const staleThreshold = parseBoundedIntOption({
    value: options.staleThreshold,
    defaultValue: 300,
    min: 60,
    max: 3600,
    optionName: 'Stale threshold',
    options,
  });

  const requestOptions: { staleThresholdSeconds?: number; folder?: string } = {
    staleThresholdSeconds: staleThreshold,
  };
  if (options.folder != null) {
    requestOptions.folder = options.folder;
  }
  const result = await client.getAgentLiveness(requestOptions);

  output({
    data: result,
    options,
    formatter: () => {
      header('Agent Liveness');

      if (result.agents.length === 0) {
        info('No agents have sent heartbeats.');
        return;
      }

      console.log();
      console.log(chalk.gray(`Stale threshold: ${result.staleThresholdSeconds.toString()} seconds`));
      console.log();

      for (const agent of result.agents) {
        const isStale = agent.stale === true;
        const statusEmoji = getStatusEmoji(agent.status, isStale);
        const staleIndicator = isStale ? chalk.red(' [STALE]') : '';
        const taskInfo = agent.currentTask != null ? chalk.gray(` → task ${agent.currentTask}`) : '';

        console.log(`${statusEmoji} ${chalk.bold(agent.author)}${staleIndicator}${taskInfo}`);
        console.log(`   ${chalk.gray('Status:')} ${agent.status}`);
        console.log(`   ${chalk.gray('Last seen:')} ${agent.lastSeen}`);
      }

      console.log();
      const aliveCount = result.agents.filter(a => a.stale !== true).length;
      const staleCount = result.agents.filter(a => a.stale === true).length;
      info(`${aliveCount.toString()} active, ${staleCount.toString()} stale`);

      if (result.webUrl != null) {
        console.log();
        console.log(chalk.gray(`Web: ${result.webUrl}`));
      }
    },
  });
}

function getStatusEmoji(status: string, stale: boolean): string {
  if (stale) return '💤';
  switch (status) {
    case 'alive':
      return '🟢';
    case 'idle':
      return '🟡';
    case 'busy':
      return '🔵';
    default:
      return '⚪';
  }
}


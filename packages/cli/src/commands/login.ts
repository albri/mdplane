import type { Command } from 'commander';
import open from 'open';
import { AUTH_FRONTEND_ROUTES, CONTROL_FRONTEND_ROUTES } from '@mdplane/shared';
import { loadConfig, getActiveProfile, getApiUrl, getAppUrl } from '../config.js';
import {
  success,
  info,
  output,
  renderAsciiWordmark,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction } from './_runtime/index.js';

interface LoginOptions extends OutputOptions {
  provider?: 'github' | 'google';
  noBrowser?: boolean;
  browser?: boolean;
  profile?: string;
}

function shouldOpenBrowser(options: Pick<LoginOptions, 'browser' | 'noBrowser'>): boolean {
  if (options.noBrowser === true) return false;
  if (options.browser === false) return false;
  return true;
}

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate via GitHub or Google OAuth')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--provider <provider>', 'OAuth provider: github or google', 'github')
    .option('--no-browser', 'Do not open browser automatically')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Login with GitHub:
    $ mdplane login --provider github

  Login with Google without opening browser:
    $ mdplane login --provider google --no-browser

  Login with a specific profile:
    $ mdplane login --profile prod --provider github

  Output as JSON:
    $ mdplane login --json
  `)
    .action(async (options: LoginOptions) => {
      await runCommandAction(options, () => runLogin(options));
    });
}

async function runLogin(options: LoginOptions): Promise<void> {
  const config = loadConfig();

  if (config == null) {
    throw new Error('No mdplane configuration found. Run "mdplane init" first.');
  }

  const profile = getActiveProfile(options.profile);

  if (profile == null) {
    const profileName = options.profile ?? config.defaultProfile ?? '(unknown)';
    throw new Error(`Profile "${profileName}" not found.`);
  }

  const apiUrl = getApiUrl(profile);
  const appUrl = getAppUrl(profile, apiUrl);

  const provider = options.provider ?? 'github';
  const authUrl = `${appUrl}${AUTH_FRONTEND_ROUTES.loginWithRedirect(CONTROL_FRONTEND_ROUTES.root)}`;

  const outputData = {
    status: 'auth_url_generated',
    provider,
    url: authUrl,
  };

  output({
    data: outputData,
    options,
    formatter: () => {
      console.log(renderAsciiWordmark());
      console.log();
      success('Opening login page...');
      console.log();
      info(`Choose ${provider === 'github' ? 'GitHub' : 'Google'} to authenticate.`);
      console.log();
      info('Once authenticated:');
      console.log('  • Run "mdplane claim" to claim your workspace');
      console.log('  • Access your workspaces via the web app');
    },
  });

  if (shouldOpenBrowser(options)) {
    try {
      await open(authUrl);
      if (options.json !== true) {
        info(`Opened browser for ${provider} authentication.`);
      }
    } catch {
      if (options.json !== true) {
        info(`Open this URL to authenticate: ${authUrl}`);
      }
    }
  } else if (options.json !== true) {
    info(`Open this URL to authenticate: ${authUrl}`);
  }
}

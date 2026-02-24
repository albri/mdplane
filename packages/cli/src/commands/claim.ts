import type { Command } from 'commander';
import open from 'open';
import { AUTH_FRONTEND_ROUTES } from '@mdplane/shared';
import { getAppUrl } from '../config.js';
import {
  success,
  info,
  exitWithValidationError,
  type OutputOptions,
} from '../utils.js';
import { requireCapabilityWriteContext, runCommandAction } from './_runtime/index.js';

interface ClaimOptions extends OutputOptions {
  provider?: string;
  profile?: string;
  noBrowser?: boolean;
  browser?: boolean;
}

function shouldOpenBrowser(options: Pick<ClaimOptions, 'browser' | 'noBrowser'>): boolean {
  if (options.noBrowser === true) return false;
  if (options.browser === false) return false;
  return true;
}

export function registerClaimCommand(program: Command): void {
  program
    .command('claim')
    .description('Claim an anonymous workspace (requires OAuth login)')
    .option('-p, --profile <name>', 'Profile to use')
    .option('--provider <provider>', 'OAuth provider: github or google', 'github')
    .option('--no-browser', 'Do not open browser automatically')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Claim workspace with GitHub:
    $ mdplane claim --provider github

  Claim workspace with Google:
    $ mdplane claim --provider google

  Claim with a specific profile:
    $ mdplane claim --profile my-workspace --provider github

  Output as JSON:
    $ mdplane claim --json

  Output URL without opening browser:
    $ mdplane claim --json --no-browser
  `)
    .action(async (options: ClaimOptions) => {
      await runCommandAction(options, () => runClaim(options));
    });
}

async function runClaim(options: ClaimOptions): Promise<void> {
  const { ctx, key: writeKey } = requireCapabilityWriteContext({
    profile: options.profile,
    options,
    unsupportedApiKeyMessage: 'Workspace claim requires capability URL mode with a write key.',
    missingWriteKeyMessage: 'Write key is required to claim a workspace.',
    missingWriteKeyHint: 'Make sure your profile contains write capability URL.',
  });

  const provider = options.provider ?? 'github';
  if (provider !== 'github' && provider !== 'google') {
    exitWithValidationError({
      message: 'Invalid provider. Use --provider github or --provider google',
      options,
    });
  }

  const appUrl = getAppUrl(ctx.profile, ctx.apiUrl);
  const claimUrl = `${appUrl}${AUTH_FRONTEND_ROUTES.claimWorkspace(writeKey)}`;

  if (options.json === true) {
    console.log(JSON.stringify({
      status: 'opening_browser',
      provider,
      url: claimUrl,
      message: 'Complete OAuth login in browser to claim workspace'
    }));
  } else {
    info(`Opening browser for ${provider === 'github' ? 'GitHub' : 'Google'} login...`);
    info('Complete login to claim your workspace.');
    console.log();
  }

  if (shouldOpenBrowser(options)) {
    await open(claimUrl);
    if (options.json !== true) {
      success('Browser opened! Complete login to claim your workspace.');
      info('After login, your workspace will be linked to your account.');
    }
  } else if (options.json !== true) {
    info(`Open this URL to claim your workspace: ${claimUrl}`);
  }
}

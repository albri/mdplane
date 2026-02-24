import { createCommandContext, extractKeyFromUrl, type CommandContext } from '../../config.js';
import { exitWithValidationError, type OutputOptions } from '../../utils.js';

export type CapabilityType = 'read' | 'append' | 'write' | 'api';

export interface RequireContextOptions<TOptions extends OutputOptions> {
  profile: string | undefined;
  options: TOptions;
  capability: CapabilityType;
  errorMessage: string | undefined;
  hint?: string;
}

export interface ContextWithKey {
  ctx: CommandContext;
  key: string;
}

export interface ContextWithKeyAndMode extends ContextWithKey {
  mode: 'api-key' | 'capability';
}

export function requireContextAndKey<TOptions extends OutputOptions>(
  opts: RequireContextOptions<TOptions>
): ContextWithKey {
  const ctx = createCommandContext(opts.profile);

  let key: string | undefined;
  let keyName: string;
  let defaultHint: string;

  switch (opts.capability) {
    case 'api':
      key = ctx.apiKey;
      keyName = 'API key';
      defaultHint =
        'Make sure your profile contains an API key or run "mdplane init --profile <name> --api-key <key>".';
      break;
    case 'read': {
      const readUrl = ctx.keys.readKey;
      key = readUrl != null ? extractKeyFromUrl(readUrl) ?? readUrl : undefined;
      keyName = 'read key';
      defaultHint =
        'Make sure your profile contains a read key or run "mdplane init --profile <name> --read-key <key>".';
      break;
    }
    case 'append': {
      const appendUrl = ctx.keys.appendKey;
      key = appendUrl != null ? extractKeyFromUrl(appendUrl) ?? appendUrl : undefined;
      keyName = 'append key';
      defaultHint =
        'Make sure your profile contains an append key or run "mdplane init --profile <name> --append-key <key>".';
      break;
    }
    case 'write': {
      const writeUrl = ctx.keys.writeKey;
      key = writeUrl != null ? extractKeyFromUrl(writeUrl) ?? writeUrl : undefined;
      keyName = 'write key';
      defaultHint =
        'Make sure your profile contains a write key or run "mdplane init --profile <name> --write-key <key>".';
      break;
    }
  }

  if (key == null || key === '') {
    exitWithValidationError({
      message:
        opts.errorMessage ?? `${keyName.charAt(0).toUpperCase() + keyName.slice(1)} is required for this command.`,
      options: opts.options,
      ...(opts.hint != null ? { helpText: opts.hint } : { helpText: defaultHint }),
    });
  }

  return { ctx, key };
}

export function requireApiKey(
  profile: string | undefined,
  options: OutputOptions,
  errorMessage?: string
): ContextWithKey;
export function requireApiKey(opts: {
  profile: string | undefined;
  options: OutputOptions;
  errorMessage?: string;
}): ContextWithKey;
export function requireApiKey(
  profileOrOpts:
    | string
    | undefined
    | {
      profile: string | undefined;
      options: OutputOptions;
      errorMessage?: string;
    },
  maybeOptions?: OutputOptions,
  maybeErrorMessage?: string
): ContextWithKey {
  const normalized = (() => {
    if (typeof profileOrOpts === 'object') {
      return profileOrOpts;
    }
    if (maybeOptions == null) {
      throw new Error('Options are required when calling requireApiKey with positional arguments.');
    }
    return {
      profile: profileOrOpts,
      options: maybeOptions,
      ...(maybeErrorMessage != null ? { errorMessage: maybeErrorMessage } : {}),
    };
  })();

  return requireContextAndKey({
    profile: normalized.profile,
    options: normalized.options,
    capability: 'api',
    errorMessage: normalized.errorMessage,
  });
}

export interface RequireCapabilityWriteOptions<TOptions extends OutputOptions> {
  profile: string | undefined;
  options: TOptions;
  unsupportedApiKeyMessage: string;
  missingWriteKeyMessage: string;
  missingWriteKeyHint: string;
}

export function requireCapabilityWriteContext<TOptions extends OutputOptions>(
  opts: RequireCapabilityWriteOptions<TOptions>
): ContextWithKey {
  const ctx = createCommandContext(opts.profile);

  if (ctx.apiKey != null && ctx.apiKey !== '') {
    exitWithValidationError({
      message: opts.unsupportedApiKeyMessage,
      options: opts.options,
    });
  }

  const writeUrl = ctx.keys.writeKey;
  const key = writeUrl != null ? extractKeyFromUrl(writeUrl) ?? writeUrl : undefined;

  if (key == null || key === '') {
    exitWithValidationError({
      message: opts.missingWriteKeyMessage,
      options: opts.options,
      helpText: opts.missingWriteKeyHint,
    });
  }

  return { ctx, key };
}

export interface RequireContextWithModeOptions<TOptions extends OutputOptions> {
  profile: string | undefined;
  options: TOptions;
  capability: Exclude<CapabilityType, 'api'>;
  errorMessage: string;
  hint: string;
}

export function requireContextWithMode<TOptions extends OutputOptions>(
  opts: RequireContextWithModeOptions<TOptions>
): ContextWithKeyAndMode {
  const ctx = createCommandContext(opts.profile);
  const apiKey = ctx.apiKey;
  if (apiKey != null && apiKey !== '') {
    return { ctx, key: apiKey, mode: 'api-key' };
  }
  const mode: ContextWithKeyAndMode['mode'] = 'capability';

  const key = (() => {
    switch (opts.capability) {
      case 'read': {
        const readUrl = ctx.keys.readKey;
        return readUrl != null ? extractKeyFromUrl(readUrl) ?? readUrl : undefined;
      }
      case 'append': {
        const appendUrl = ctx.keys.appendKey;
        return appendUrl != null ? extractKeyFromUrl(appendUrl) ?? appendUrl : undefined;
      }
      case 'write': {
        const writeUrl = ctx.keys.writeKey;
        return writeUrl != null ? extractKeyFromUrl(writeUrl) ?? writeUrl : undefined;
      }
    }
  })();

  if (key == null || key === '') {
    exitWithValidationError({
      message: opts.errorMessage,
      options: opts.options,
      helpText: opts.hint,
    });
  }

  return { ctx, key, mode };
}

/**
 * Command context and getRequiredKey.
 */
import type { CommandContext } from './types.js';
import { extractKeyFromUrl, getApiKey, getApiUrl, getCapabilityKeys, requireAuth } from './profile.js';

/**
 * Create command context with all auth info resolved.
 */
export function createCommandContext(profileName?: string): CommandContext {
  const { profile } = requireAuth(profileName);
  const apiUrl = getApiUrl(profile);
  const apiKey = getApiKey(profile);
  const keys = getCapabilityKeys(profile);
  return { profile, apiUrl, apiKey, keys };
}

/**
 * Get a required capability key, or return null if not available.
 * Use with exitWithValidationError for clean error handling.
 */
export function getRequiredKey(
  ctx: CommandContext,
  capability: 'read' | 'append' | 'write'
): string | null {
  if (ctx.apiKey != null && ctx.apiKey !== '') {
    return ctx.apiKey;
  }
  const rawKey = ctx.keys[`${capability}Key`];
  const key = rawKey != null && rawKey !== '' ? extractKeyFromUrl(rawKey) ?? rawKey : rawKey;
  if (key != null && key !== '') {
    return key;
  }
  return null;
}

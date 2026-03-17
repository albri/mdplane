/**
 * Active profile and key resolution.
 */
import { URLS } from '@mdplane/shared';
import type { Profile } from './types.js';
import { loadConfig } from './store.js';

/**
 * Get active profile by name or default
 */
export function getActiveProfile(profileName?: string): Profile | null {
  const config = loadConfig();
  if (config == null) {
    return null;
  }

  const name = profileName ?? config.defaultProfile;
  if (name == null || config.profiles[name] == null) {
    return null;
  }

  return config.profiles[name] ?? null;
}

/**
 * Get API URL from profile or environment
 */
export function getApiUrl(profile: Profile | null): string {
  return process.env.MDPLANE_API_URL ?? profile?.baseUrl ?? URLS.API;
}

/**
 * Get app URL from environment, profile web URL, or derived API URL.
 */
export function getAppUrl(profile: Profile | null, resolvedApiUrl?: string): string {
  const envAppUrl = process.env.MDPLANE_APP_URL;
  if (envAppUrl != null && envAppUrl !== '') {
    return envAppUrl.replace(/\/$/, '');
  }

  const profileWebUrl = profile?.webUrl;
  if (profileWebUrl != null && profileWebUrl !== '') {
    try {
      return new URL(profileWebUrl).origin;
    } catch {
      // Fall through to API-derived or default app URL.
    }
  }

  const apiUrl = resolvedApiUrl ?? getApiUrl(profile);
  try {
    const parsed = new URL(apiUrl);
    const hostname = parsed.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (parsed.port === '3001') {
        parsed.port = '3000';
      }
      return parsed.origin;
    }
  } catch {
    // Fall through to default app URL.
  }

  return URLS.APP;
}

/**
 * Get API key from profile, environment, or flags
 */
export function getApiKey(profile: Profile | null, apiKeyFlag?: string): string | undefined {
  return apiKeyFlag ?? process.env.MDPLANE_API_KEY ?? profile?.apiKey;
}

/**
 * Get capability keys from profile, environment, or flags
 */
export function getCapabilityKeys(
  profile: Profile | null,
  flags: {
    readKey?: string;
    appendKey?: string;
    writeKey?: string;
  } = {}
): {
  readKey: string | undefined;
  appendKey: string | undefined;
  writeKey: string | undefined;
} {
  return {
    readKey: flags.readKey ?? process.env.MDPLANE_READ_KEY ?? profile?.capabilityUrls?.read,
    appendKey: flags.appendKey ?? process.env.MDPLANE_APPEND_KEY ?? profile?.capabilityUrls?.append,
    writeKey: flags.writeKey ?? process.env.MDPLANE_WRITE_KEY ?? profile?.capabilityUrls?.write,
  };
}

/**
 * Validate that required auth config exists
 */
export function requireAuth(profileName?: string): { profile: Profile } {
  const profile = getActiveProfile(profileName);
  if (profile == null) {
    throw new Error(
      'No mdplane configuration found. Run "mdplane init" to create a workspace or "mdplane init --profile <name> --api-key <key>" to configure API key mode.'
    );
  }

  if (profile.mode === 'api-key' && profile.apiKey == null) {
    throw new Error(
      'API key mode configured but no API key set. Run "mdplane init --profile <name> --api-key <key>" to add an API key.'
    );
  }

  if (profile.mode === 'capability' && !profile.capabilityUrls) {
    throw new Error(
      'Capability mode configured but no capability URLs found. Run "mdplane init" to bootstrap a new workspace.'
    );
  }

  return { profile };
}

/**
 * Mask a capability key or API key for display (show first 4 and last 4 chars)
 */
export function maskKey(key: string | undefined): string {
  if (key == null || key === '') return '(not set)';
  if (key.length <= 12) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Extract key from capability URL (e.g., https://mdplane.dev/r/KEY/...)
 */
export function extractKeyFromUrl(url: string): string | undefined {
  const match = /\/(r|a|w)\/([^/]+)/.exec(url);
  return match?.[2];
}

/**
 * Config migration: old format detection + migration.
 */
import { URLS } from '@mdplane/shared';
import type { CliConfig, MdPlaneConfig, Profile } from './types.js';

/**
 * Check if config is in old format (backward compatibility)
 */
export function isOldConfigFormat(data: unknown): boolean {
  if (typeof data !== 'object' || data == null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return !('profiles' in obj);
}

/**
 * Migrate old config format to new profile-based format
 */
export function migrateOldConfig(oldConfig: MdPlaneConfig): CliConfig {
  const profileName = oldConfig.workspaceName ?? 'default';

  const baseProps: Partial<Profile> = {
    name: profileName,
    baseUrl: oldConfig.apiUrl ?? URLS.API,
    mode: oldConfig.apiKey != null ? 'api-key' : 'capability',
  };

  if (oldConfig.workspaceId != null) {
    baseProps.workspaceId = oldConfig.workspaceId;
  }
  if (oldConfig.workspaceName != null) {
    baseProps.workspaceName = oldConfig.workspaceName;
  }
  if (oldConfig.claimed != null) {
    baseProps.claimed = oldConfig.claimed;
  }

  const profile: Profile = oldConfig.apiKey != null
    ? { ...baseProps, apiKey: oldConfig.apiKey } as Profile
    : oldConfig.readKey != null || oldConfig.appendKey != null || oldConfig.writeKey != null
      ? {
          ...baseProps,
          capabilityUrls: {
            ...(oldConfig.readKey != null ? { read: oldConfig.readKey } : {}),
            ...(oldConfig.appendKey != null ? { append: oldConfig.appendKey } : {}),
            ...(oldConfig.writeKey != null ? { write: oldConfig.writeKey } : {}),
          },
        } as Profile
      : baseProps as Profile;

  return {
    defaultProfile: profileName,
    profiles: {
      [profileName]: profile,
    },
  };
}


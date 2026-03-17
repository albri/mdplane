import { db } from '../../db';
import type { CapabilityKeyRecord, KeyValidationResult, Permission } from '../../shared';
import { validateCapabilityKeyForCapabilityRoute } from '../../shared';
import type { FolderSettings } from '@mdplane/shared';

type ValidateAndGetKeyInput = {
  keyString: string;
  pathHint?: string;
  requiredPermission?: Permission;
};

export async function validateAndGetKey({
  keyString,
  pathHint,
  requiredPermission,
}: ValidateAndGetKeyInput): Promise<KeyValidationResult> {
  return validateCapabilityKeyForCapabilityRoute({
    keyString,
    lookupByHash: async (keyHash) => {
      const keyRecord = await db.query.capabilityKeys.findFirst({
        where: (fields, { eq }) => eq(fields.keyHash, keyHash),
      });
      return keyRecord as CapabilityKeyRecord | null;
    },
    pathHint,
    requiredPermission,
  });
}

export function normalizeMovePath(path: string): string {
  let decoded = decodeURIComponent(path);
  decoded = decoded.replace(/\/+/g, '/');
  if (!decoded.startsWith('/')) {
    decoded = '/' + decoded;
  }
  if (decoded !== '/' && decoded.endsWith('/')) {
    decoded = decoded.slice(0, -1);
  }
  return decoded;
}
export function toFolderPathNoSlash(folderPath: string): string {
  if (folderPath === '/') return '';
  return folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;
}

const DEFAULT_FOLDER_SETTINGS: FolderSettings = {
  inheritSettings: true,
  defaultLabels: [],
  allowedTypes: ['task', 'claim', 'response', 'comment', 'blocked', 'answer', 'renew', 'cancel', 'vote'],
};

export function parseStoredSettings(settingsJson: unknown): FolderSettings {
  const settings: FolderSettings = { ...DEFAULT_FOLDER_SETTINGS };

  if (!settingsJson || typeof settingsJson !== 'object') {
    return settings;
  }

  const stored = settingsJson as Record<string, unknown>;

  if (typeof stored.inheritSettings === 'boolean') {
    settings.inheritSettings = stored.inheritSettings;
  }
  if (Array.isArray(stored.defaultLabels)) {
    settings.defaultLabels = stored.defaultLabels.filter((l): l is string => typeof l === 'string');
  }
  if (Array.isArray(stored.allowedTypes)) {
    settings.allowedTypes = stored.allowedTypes.filter(
      (t): t is FolderSettings['allowedTypes'] extends (infer U)[] | undefined ? U : never =>
        typeof t === 'string' && (DEFAULT_FOLDER_SETTINGS.allowedTypes ?? []).includes(t as 'task')
    );
  }

  return settings;
}

export function getDefaultFolderSettings(): FolderSettings {
  return { ...DEFAULT_FOLDER_SETTINGS };
}

export function validateCascadeConfirmPath(
  confirmPath: string | undefined,
  folderPath: string
): string | null {
  const pathForResponse = folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;
  const expectedConfirmPath = pathForResponse.startsWith('/')
    ? pathForResponse.substring(1)
    : pathForResponse;

  if (confirmPath !== expectedConfirmPath) {
    return `confirmPath '${confirmPath || ''}' does not match folder path '${expectedConfirmPath}'`;
  }

  return null;
}

export function validateMovePaths(
  source: string,
  destination: string
): { code: string; message: string } | null {
  if (source === '/') {
    return { code: 'INVALID_PATH', message: 'Cannot move root folder' };
  }

  if (source === destination) {
    return { code: 'INVALID_PATH', message: 'Source and destination are the same' };
  }

  if (destination.startsWith(source + '/')) {
    return { code: 'INVALID_PATH', message: 'Cannot move folder into itself' };
  }

  return null;
}


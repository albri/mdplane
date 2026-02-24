import { db, sqlite } from '../../db';
import { hashKey } from '../../core/capability-keys';
import { validateCapabilityKeyForCapabilityRoute, type CapabilityKeyRecord } from '../../shared';
import type { KeyValidationResult } from './types';

export { hashKey };

export async function validateAndGetKey(keyString: string): Promise<KeyValidationResult> {
  const validationResult = await validateCapabilityKeyForCapabilityRoute({
    keyString,
    lookupByHash: async (keyHash) => {
      const keyRecord = await db.query.capabilityKeys.findFirst({
        where: (fields, { eq }) => eq(fields.keyHash, keyHash),
      });
      return keyRecord as CapabilityKeyRecord | null;
    },
    config: {
      invalidKey: { status: 404, code: 'NOT_FOUND', message: 'Key not found' },
      revoked: { status: 410, code: 'KEY_REVOKED', message: 'Key has been revoked' },
      expired: { status: 404, code: 'NOT_FOUND', message: 'Key not found' },
    },
  });

  if (!validationResult.ok) {
    return {
      ok: false,
      error: validationResult.error,
      status: validationResult.status,
    };
  }

  return {
    ok: true,
    key: validationResult.key,
    keyString,
  };
}

export function checkKeyNotRevoked(keyHash: string): {
  ok: true;
} | {
  ok: false;
  code: string;
  status: number;
} {
  const keyRecord = sqlite.query<{ revoked_at: string | null }, [string]>(
    'SELECT revoked_at FROM capability_keys WHERE key_hash = ?'
  ).get(keyHash);

  if (!keyRecord) {
    return { ok: false, code: 'KEY_NOT_FOUND', status: 404 };
  }

  if (keyRecord.revoked_at !== null) {
    return { ok: false, code: 'KEY_REVOKED', status: 410 };
  }

  return { ok: true };
}

import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { capabilityKeys } from '../../db/schema';
import { hashKey } from '../../core/capability-keys';
import type { CapabilityKeyRecord } from '../../shared';
import { evaluateCapabilityKeyRecord, isCapabilityKeyFormatValid } from '../../shared';
import { isUrlBlocked } from '../../core/ssrf';
import type { KeyValidationResult } from './types';

export async function validateAdminKey(adminKey: string): Promise<KeyValidationResult> {
  if (!isCapabilityKeyFormatValid(adminKey)) {
    return { valid: false };
  }

  const keyHash = hashKey(adminKey);
  const keyRecord = await db.query.capabilityKeys.findFirst({
    where: eq(capabilityKeys.keyHash, keyHash),
  });

  const validationError = evaluateCapabilityKeyRecord({
    keyRecord: keyRecord as CapabilityKeyRecord | null,
    requiredPermission: 'write',
  });
  if (validationError && !validationError.ok) {
    return { valid: false };
  }

  if (!keyRecord) {
    return { valid: false };
  }

  return { valid: true, workspaceId: keyRecord.workspaceId };
}

export function invalidCapabilityKeyResponse() {
  return {
    ok: false as const,
    error: {
      code: 'INVALID_KEY' as const,
      message: 'Invalid or missing capability key',
    },
  };
}

export type UrlValidationResult =
  | { ok: true }
  | { ok: false; error: { code: 'INVALID_WEBHOOK_URL'; message: string } };

export function validateWebhookUrl(url: string): UrlValidationResult {
  if (url.length > 2000) {
    return {
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_URL',
        message: 'URL exceeds maximum length of 2000 characters',
      },
    };
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(url)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_URL',
        message: 'URL contains invalid control characters',
      },
    };
  }

  if (isUrlBlocked(url)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_URL',
        message: 'URL is not allowed (SSRF protection)',
      },
    };
  }

  return { ok: true };
}


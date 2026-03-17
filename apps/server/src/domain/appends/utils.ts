import { sqlite } from '../../db';
import { generateKey } from '../../core/capability-keys';
import { zAppendResponse, zError } from '@mdplane/shared';
import type { AppendResponse } from '@mdplane/shared';
import type { AppendsErrorBody } from './types';

type IdempotencyBody = AppendResponse | AppendsErrorBody;
type IdempotencyCached = { status: number; body: IdempotencyBody };
type IdempotencyClaimResult =
  | { kind: 'owner' }
  | { kind: 'cached'; cached: IdempotencyCached }
  | { kind: 'pending' };

export async function getNextAppendId(fileId: string): Promise<string> {
  const result = sqlite
    .query(
      `
      INSERT INTO append_counters (file_id, next_value)
      VALUES (?, 1)
      ON CONFLICT(file_id) DO UPDATE SET next_value = next_value + 1
      RETURNING next_value
      `
    )
    .get(fileId) as { next_value: number };

  return `a${result.next_value}`;
}

export function generateId(): string {
  return generateKey(16);
}

function parseIdempotencyBody(rawJson: string): IdempotencyBody | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  const appendResponse = zAppendResponse.safeParse(parsed);
  if (appendResponse.success) {
    return appendResponse.data;
  }

  const errorResponse = zError.safeParse(parsed);
  if (errorResponse.success) {
    return errorResponse.data;
  }

  return null;
}

export function claimIdempotencyKey({
  idempotencyKey,
  capabilityKeyId,
  createdAt,
}: {
  idempotencyKey: string;
  capabilityKeyId: string;
  createdAt: string;
}): IdempotencyClaimResult {
  const inserted = sqlite
    .prepare(
      `
      INSERT OR IGNORE INTO idempotency_keys (key, capability_key_id, response_status, response_body, created_at)
      VALUES (?, ?, 0, '{}', ?)
      `
    )
    .run(idempotencyKey, capabilityKeyId, createdAt);

  if (inserted.changes > 0) {
    return { kind: 'owner' };
  }

  const existing = sqlite
    .prepare(
      `
      SELECT response_status as responseStatus, response_body as responseBody
      FROM idempotency_keys
      WHERE key = ?
      `
    )
    .get(idempotencyKey) as { responseStatus: number; responseBody: string } | null;

  if (existing && existing.responseStatus > 0) {
    const parsedBody = parseIdempotencyBody(existing.responseBody);
    if (!parsedBody) {
      return { kind: 'pending' };
    }

    return {
      kind: 'cached',
      cached: {
        status: existing.responseStatus,
        body: parsedBody,
      },
    };
  }

  return { kind: 'pending' };
}

export async function waitForIdempotencyResult({
  idempotencyKey,
  timeoutMs = 2000,
  intervalMs = 10,
}: {
  idempotencyKey: string;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<IdempotencyCached | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const existing = sqlite
      .prepare(
        `
        SELECT response_status as responseStatus, response_body as responseBody
        FROM idempotency_keys
        WHERE key = ?
        `
      )
      .get(idempotencyKey) as { responseStatus: number; responseBody: string } | null;

    if (existing && existing.responseStatus > 0) {
      const parsedBody = parseIdempotencyBody(existing.responseBody);
      if (!parsedBody) {
        return null;
      }

      return {
        status: existing.responseStatus,
        body: parsedBody,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

export function finalizeIdempotencyKey({
  idempotencyKey,
  status,
  body,
}: {
  idempotencyKey: string;
  status: number;
  body: IdempotencyBody;
}): void {
  sqlite
    .prepare(
      `
      UPDATE idempotency_keys
      SET response_status = ?, response_body = ?
      WHERE key = ? AND response_status = 0
      `
    )
    .run(status, JSON.stringify(body), idempotencyKey);
}

export function clearPendingIdempotencyKey(idempotencyKey: string): void {
  sqlite
    .prepare(
      `
      DELETE FROM idempotency_keys
      WHERE key = ? AND response_status = 0
      `
    )
    .run(idempotencyKey);
}

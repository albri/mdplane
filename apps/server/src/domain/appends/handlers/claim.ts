import { appends } from '../../../db/schema';
import { generateKey } from '../../../core/capability-keys';
import { DEFAULT_CLAIM_EXPIRY_SECONDS } from '../types';
import type { AppendHandlerContext, AppendHandlerResult } from './types';

function generateId(): string {
  return generateKey(16);
}

export async function handleClaim(ctx: AppendHandlerContext): Promise<AppendHandlerResult> {
  const { sqlite, file, body, now, nowIso, appendId, capKey } = ctx;

  if (!body.ref) {
    return { status: 400, error: { code: 'INVALID_REQUEST', message: 'ref is required for claim' } };
  }

  // Check WIP limit FIRST (before ref validation)
  if (capKey.wipLimit != null) {
    const wipLimit = capKey.wipLimit;
    const activeClaimsResult = sqlite
      .query(`
        SELECT COUNT(*) as count
        FROM appends a
        JOIN files f ON f.id = a.file_id
        WHERE f.workspace_id = ? AND a.author = ? AND a.type = 'claim' AND a.status = 'active' AND a.expires_at > ?
      `)
      .get(file.workspaceId, body.author, nowIso) as { count: number };

    if (activeClaimsResult.count >= wipLimit) {
      return {
        status: 429,
        error: {
          code: 'WIP_LIMIT_EXCEEDED',
          message: 'WIP limit exceeded',
          details: { currentCount: activeClaimsResult.count, limit: wipLimit },
        },
      };
    }
  }

  // Use IMMEDIATE transaction for atomic claim check + insert
  try {
    sqlite.exec('BEGIN IMMEDIATE');

    const refAppend = sqlite.query(`
      SELECT * FROM appends WHERE file_id = ? AND append_id = ?
    `).get(file.id, body.ref) as { type: string; status: string | null } | null;

    if (!refAppend) {
      sqlite.exec('ROLLBACK');
      return { status: 404, error: { code: 'APPEND_NOT_FOUND', message: 'Referenced append not found' } };
    }

    if (refAppend.type !== 'task') {
      sqlite.exec('ROLLBACK');
      return { status: 400, error: { code: 'INVALID_REF', message: 'Ref must reference a task' } };
    }

    if (refAppend.status === 'done') {
      sqlite.exec('ROLLBACK');
      return { status: 400, error: { code: 'TASK_ALREADY_COMPLETE', message: 'Task is already completed' } };
    }

    const existingClaim = sqlite.query(`
      SELECT * FROM appends
      WHERE file_id = ? AND ref = ? AND type = 'claim' AND status = 'active' AND expires_at > ?
    `).get(file.id, body.ref, nowIso) as { id: string; append_id: string; author: string; expires_at: string | null; created_at: string } | null;

    if (existingClaim) {
      if (existingClaim.author === body.author) {
        const expiresInSeconds = body.expiresInSeconds ?? DEFAULT_CLAIM_EXPIRY_SECONDS;
        const newExpiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
        sqlite.prepare('UPDATE appends SET expires_at = ? WHERE id = ?').run(newExpiresAt, existingClaim.id);
        sqlite.exec('COMMIT');
        return { responsePatch: { ref: body.ref, expiresAt: newExpiresAt, expiresInSeconds } };
      }

      sqlite.exec('ROLLBACK');
      const retryAfterMs = existingClaim.expires_at
        ? Math.max(0, new Date(existingClaim.expires_at).getTime() - now.getTime())
        : 0;
      return {
        status: 409,
        error: {
          code: 'ALREADY_CLAIMED',
          message: 'Task already has an active claim',
          details: { claimedBy: existingClaim.author, expiresAt: existingClaim.expires_at, retryAfterMs },
        },
      };
    }

    const expiresInSeconds = body.expiresInSeconds ?? DEFAULT_CLAIM_EXPIRY_SECONDS;
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();

    sqlite.prepare(
      'INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at, content_preview) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(generateId(), file.id, appendId, body.author, 'claim', body.ref, 'active', expiresAt, nowIso, body.content ?? null);

    sqlite.exec('COMMIT');
    return { responsePatch: { ref: body.ref, expiresAt, expiresInSeconds } };
  } catch (err) {
    try { sqlite.exec('ROLLBACK'); } catch { /* ignore rollback errors */ }
    throw err;
  }
}


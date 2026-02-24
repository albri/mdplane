import { eq, and } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { appends } from '../../db/schema';
import { logAction } from '../../services/audit';
import { triggerWebhooks } from '../../services/webhook-trigger';
import { emit, type EventType } from '../../services/event-bus';
import type { MultiAppendResult } from '@mdplane/shared';
import { serverEnv } from '../../config/env';

import {
  type ProcessSingleAppendInput,
  type ProcessSingleAppendResult,
  type HandleMultiAppendInput,
  type HandleMultiAppendResult,
  DEFAULT_CLAIM_EXPIRY_SECONDS,
} from './types';
import { isValidAppendType } from './validation';
import {
  claimIdempotencyKey,
  clearPendingIdempotencyKey,
  finalizeIdempotencyKey,
  generateId,
  getNextAppendId,
  waitForIdempotencyResult,
} from './utils';

const APP_URL = serverEnv.appUrl;

export async function processSingleAppend({
  file,
  author,
  item,
  capKey,
  now,
}: ProcessSingleAppendInput): Promise<ProcessSingleAppendResult> {
  const nowIso = now.toISOString();
  const appendType = item.type;

  if (item.type && !isValidAppendType(item.type)) {
    return { ok: false, error: { code: 'INVALID_APPEND_TYPE', message: 'Invalid append type' } };
  }

  if (!item.type && item.ref) {
    return { ok: false, error: { code: 'INVALID_REQUEST', message: 'type is required' } };
  }

  const appendId = await getNextAppendId(file.id);

  const responseData: MultiAppendResult['appends'][number] = {
    id: appendId,
    type: appendType,
  };

  if (item.ref) {
    responseData.ref = item.ref;
  }

  switch (appendType) {
    case 'task': {
      await db.insert(appends).values({
        id: generateId(),
        fileId: file.id,
        appendId,
        author,
        type: 'task',
        status: 'open',
        priority: item.priority ?? null,
        labels: item.labels ? JSON.stringify(item.labels) : null,
        dueAt: item.dueAt ?? null,
        createdAt: nowIso,
        contentPreview: item.content ?? null,
      });
      break;
    }

    case 'claim': {
      if (!item.ref) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: 'ref is required for claim' } };
      }

      // Check WIP limit
      if (capKey.wipLimit != null) {
        const wipLimit = capKey.wipLimit;
        const activeClaimsResult = sqlite
          .query(
            `
            SELECT COUNT(*) as count
            FROM appends a
            JOIN files f ON f.id = a.file_id
            WHERE
              f.workspace_id = ?
              AND a.author = ?
              AND a.type = 'claim'
              AND a.status = 'active'
              AND a.expires_at > ?
          `
          )
          .get(capKey.workspaceId, author, nowIso) as { count: number };

        if (activeClaimsResult.count >= wipLimit) {
          return {
            ok: false,
            error: {
              code: 'WIP_LIMIT_EXCEEDED' as const,
              message: 'WIP limit exceeded',
              details: {
                currentCount: activeClaimsResult.count,
                limit: wipLimit,
              },
            },
          };
        }
      }

      // Use IMMEDIATE transaction for atomic claim check + insert
      try {
        sqlite.exec('BEGIN IMMEDIATE');

        const refAppend = sqlite.query(`
          SELECT * FROM appends WHERE file_id = ? AND append_id = ?
        `).get(file.id, item.ref) as { type: string; status: string | null } | null;

        if (!refAppend) {
          sqlite.exec('ROLLBACK');
          return { ok: false, error: { code: 'APPEND_NOT_FOUND', message: 'Referenced append not found' } };
        }

        if (refAppend.type !== 'task') {
          sqlite.exec('ROLLBACK');
          return { ok: false, error: { code: 'INVALID_REF', message: 'Ref must reference a task' } };
        }

        if (refAppend.status === 'done') {
          sqlite.exec('ROLLBACK');
          return { ok: false, error: { code: 'TASK_ALREADY_COMPLETE', message: 'Task is already completed' } };
        }

        const existingClaim = sqlite.query(`
          SELECT * FROM appends
          WHERE file_id = ? AND ref = ? AND type = 'claim' AND status = 'active' AND expires_at > ?
        `).get(file.id, item.ref, nowIso) as { id: string; append_id: string; author: string; expires_at: string | null; created_at: string } | null;

        if (existingClaim) {
          if (existingClaim.author === author) {
            const expiresInSeconds = item.expiresInSeconds ?? DEFAULT_CLAIM_EXPIRY_SECONDS;
            const newExpiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();

            const updateExpiryStmt = sqlite.prepare('UPDATE appends SET expires_at = ? WHERE id = ?');
            updateExpiryStmt.run(newExpiresAt, existingClaim.id);
            sqlite.exec('COMMIT');

            responseData.expiresAt = newExpiresAt;
            responseData.expiresInSeconds = expiresInSeconds;
            break;
          }

          sqlite.exec('ROLLBACK');
          const retryAfterMs = existingClaim.expires_at
            ? Math.max(0, new Date(existingClaim.expires_at).getTime() - now.getTime())
            : 0;
          return {
            ok: false,
            error: {
              code: 'ALREADY_CLAIMED',
              message: 'Task already has an active claim',
              details: {
                claimedBy: existingClaim.author,
                expiresAt: existingClaim.expires_at,
                retryAfterMs
              }
            }
          };
        }

        const expiresInSeconds = item.expiresInSeconds ?? DEFAULT_CLAIM_EXPIRY_SECONDS;
        const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();

        responseData.expiresAt = expiresAt;
        responseData.expiresInSeconds = expiresInSeconds;

        const claimId = generateId();
        const insertClaimStmt = sqlite.prepare(
          'INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at, content_preview) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        insertClaimStmt.run(claimId, file.id, appendId, author, 'claim', item.ref, 'active', expiresAt, nowIso, item.content ?? null);

        sqlite.exec('COMMIT');
      } catch (err) {
        try { sqlite.exec('ROLLBACK'); } catch { /* ignore rollback errors */ }
        throw err;
      }
      break;
    }

    case 'response': {
      if (!item.ref) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: 'ref is required for response' } };
      }
      if (!item.content) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: 'content is required for response' } };
      }

      const releaseClaimStmt = sqlite.prepare(
        'UPDATE appends SET status = ? WHERE file_id = ? AND ref = ? AND type = ? AND status = ?'
      );
      releaseClaimStmt.run('completed', file.id, item.ref, 'claim', 'active');

      const setTaskDoneStmt = sqlite.prepare(
        'UPDATE appends SET status = ? WHERE file_id = ? AND append_id = ? AND type = ?'
      );
      setTaskDoneStmt.run('done', file.id, item.ref, 'task');

      await db.insert(appends).values({
        id: generateId(),
        fileId: file.id,
        appendId,
        author,
        type: 'response',
        ref: item.ref,
        status: 'completed',
        createdAt: nowIso,
        contentPreview: item.content,
      });
      break;
    }

    case 'comment': {
      await db.insert(appends).values({
        id: generateId(),
        fileId: file.id,
        appendId,
        author,
        type: 'comment',
        ref: item.ref ?? null,
        createdAt: nowIso,
        contentPreview: item.content ?? null,
      });
      break;
    }

    case 'blocked': {
      if (!item.ref) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: 'ref is required for blocked' } };
      }

      await db.insert(appends).values({
        id: generateId(),
        fileId: file.id,
        appendId,
        author,
        type: 'blocked',
        ref: item.ref,
        status: 'active',
        createdAt: nowIso,
        contentPreview: item.content ?? null,
      });
      break;
    }

    case 'answer': {
      if (!item.ref) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: 'ref is required for answer' } };
      }

      const refAppend = await db.query.appends.findFirst({
        where: and(eq(appends.fileId, file.id), eq(appends.appendId, item.ref)),
      });

      if (!refAppend) {
        return { ok: false, error: { code: 'APPEND_NOT_FOUND', message: 'Referenced append not found' } };
      }

      if (refAppend.type !== 'blocked') {
        return { ok: false, error: { code: 'INVALID_REF', message: 'Answer must reference a blocked append' } };
      }

      await db.insert(appends).values({
        id: generateId(),
        fileId: file.id,
        appendId,
        author,
        type: 'answer',
        ref: item.ref,
        createdAt: nowIso,
        contentPreview: item.content ?? null,
      });
      break;
    }

    case 'cancel': {
      if (!item.ref) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: 'ref is required for cancel' } };
      }

      const claimToCancel = await db.query.appends.findFirst({
        where: and(
          eq(appends.fileId, file.id),
          eq(appends.appendId, item.ref),
          eq(appends.type, 'claim')
        ),
      });

      if (!claimToCancel) {
        return { ok: false, error: { code: 'APPEND_NOT_FOUND', message: 'Claim not found' } };
      }

      if (claimToCancel.author !== author) {
        return { ok: false, error: { code: 'CANNOT_CANCEL_OTHERS_CLAIM', message: "Cannot cancel another author's claim" } };
      }

      const cancelClaimStmt = sqlite.prepare('UPDATE appends SET status = ? WHERE id = ?');
      cancelClaimStmt.run('cancelled', claimToCancel.id);

      if (claimToCancel.ref) {
        const reopenTaskStmt = sqlite.prepare(
          'UPDATE appends SET status = ? WHERE file_id = ? AND append_id = ? AND type = ?'
        );
        reopenTaskStmt.run('open', file.id, claimToCancel.ref, 'task');
      }

      await db.insert(appends).values({
        id: generateId(),
        fileId: file.id,
        appendId,
        author,
        type: 'cancel',
        ref: item.ref,
        createdAt: nowIso,
      });
      break;
    }

    case 'renew': {
      if (!item.ref) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: 'ref is required for renew' } };
      }

      const claimToRenew = await db.query.appends.findFirst({
        where: and(
          eq(appends.fileId, file.id),
          eq(appends.appendId, item.ref),
          eq(appends.type, 'claim')
        ),
      });

      if (!claimToRenew) {
        return { ok: false, error: { code: 'APPEND_NOT_FOUND', message: 'Claim not found' } };
      }

      if (claimToRenew.author !== author) {
        return { ok: false, error: { code: 'CANNOT_RENEW_OTHERS_CLAIM', message: "Cannot renew another author's claim" } };
      }

      const expiresInSeconds = item.expiresInSeconds ?? DEFAULT_CLAIM_EXPIRY_SECONDS;
      const newExpiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();

      const renewClaimStmt = sqlite.prepare('UPDATE appends SET expires_at = ? WHERE id = ?');
      renewClaimStmt.run(newExpiresAt, claimToRenew.id);

      responseData.expiresAt = newExpiresAt;
      responseData.expiresInSeconds = expiresInSeconds;

      await db.insert(appends).values({
        id: generateId(),
        fileId: file.id,
        appendId,
        author,
        type: 'renew',
        ref: item.ref,
        expiresAt: newExpiresAt,
        createdAt: nowIso,
      });
      break;
    }

    case 'vote': {
      if (!item.ref) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: 'ref is required for vote' } };
      }

      if (item.value !== '+1' && item.value !== '-1') {
        return { ok: false, error: { code: 'INVALID_VOTE_VALUE', message: 'Vote value must be +1 or -1' } };
      }

      await db.insert(appends).values({
        id: generateId(),
        fileId: file.id,
        appendId,
        author,
        type: 'vote',
        ref: item.ref,
        createdAt: nowIso,
        contentPreview: item.content ?? null,
      });
      break;
    }

    default: {
      await db.insert(appends).values({
        id: generateId(),
        fileId: file.id,
        appendId,
        author,
        type: appendType ?? null,
        createdAt: nowIso,
        contentPreview: item.content ?? null,
      });
    }
  }

  return { ok: true, data: responseData };
}

export async function handleMultiAppend({
  key,
  file,
  author,
  appendItems,
  capKey,
  idempotencyKey,
}: HandleMultiAppendInput): Promise<HandleMultiAppendResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const results: MultiAppendResult['appends'] = [];
  let ownsIdempotencyClaim = false;

  if (idempotencyKey) {
    const claimResult = claimIdempotencyKey({
      idempotencyKey,
      capabilityKeyId: capKey.id,
      createdAt: nowIso,
    });

    if (claimResult.kind === 'cached') {
      return {
        status: claimResult.cached.status,
        body: claimResult.cached.body,
      };
    }

    if (claimResult.kind === 'pending') {
      const pendingResult = await waitForIdempotencyResult({ idempotencyKey });
      if (pendingResult) {
        return {
          status: pendingResult.status,
          body: pendingResult.body,
        };
      }
      return {
        status: 409,
        body: {
          ok: false,
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Another request with this Idempotency-Key is currently in progress',
          },
        },
      };
    }

    ownsIdempotencyClaim = true;
  }

  for (const item of appendItems) {
    if (item.type && !isValidAppendType(item.type)) {
      if (idempotencyKey && ownsIdempotencyClaim) {
        clearPendingIdempotencyKey(idempotencyKey);
      }
      return {
        status: 400,
        body: { ok: false, error: { code: 'INVALID_APPEND_TYPE', message: 'Invalid append type' } }
      };
    }
    if (!item.type && item.ref) {
      if (idempotencyKey && ownsIdempotencyClaim) {
        clearPendingIdempotencyKey(idempotencyKey);
      }
      return {
        status: 400,
        body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'type is required' } }
      };
    }
  }

  try {
    sqlite.exec('BEGIN TRANSACTION');

    for (const item of appendItems) {
      const result = await processSingleAppend({
        file,
        author,
        item,
        capKey,
        now,
      });
      if (!result.ok) {
        sqlite.exec('ROLLBACK');
        if (idempotencyKey && ownsIdempotencyClaim) {
          clearPendingIdempotencyKey(idempotencyKey);
        }
        return { status: 400, body: { ok: false, error: result.error } };
      }
      results.push(result.data);
    }

    sqlite.exec('COMMIT');
  } catch (error) {
    try {
      sqlite.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors if no active transaction exists
    }
    if (idempotencyKey && ownsIdempotencyClaim) {
      clearPendingIdempotencyKey(idempotencyKey);
    }
    throw error;
  }

  // Log audit event (async, non-blocking)
  logAction({
    workspaceId: capKey.workspaceId,
    action: 'append',
    resourceType: 'file',
    resourceId: file.id,
    resourcePath: file.path,
    actor: author,
    actorType: 'capability_url',
    metadata: {
      count: appendItems.length,
      types: appendItems.map(a => a.type),
    },
  });

  // Trigger webhooks and emit events for each append in the batch
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const item = appendItems[i];

    const webhookEvent = result.type === 'task' ? 'task.created' :
                         result.type === 'claim' ? 'claim.created' :
                         result.type === 'renew' ? 'claim.renewed' :
                         result.type === 'response' ? 'task.completed' :
                         result.type === 'blocked' ? 'task.blocked' :
                         result.type === 'cancel' ? 'claim.released' :
                         'append.created';
    triggerWebhooks(
      capKey.workspaceId,
      webhookEvent,
      {
        append: {
          id: result.id,
          type: result.type,
          author,
        },
        file: { id: file.id, path: file.path },
      },
      file.path
    ).catch((err) => console.error('Webhook trigger failed:', err));

    const eventType: EventType = result.type === 'task' ? 'task.created' :
                                 result.type === 'claim' ? 'claim.created' :
                                 result.type === 'renew' ? 'claim.renewed' :
                                 result.type === 'response' ? 'task.completed' :
                                 result.type === 'blocked' ? 'task.blocked' :
                                 result.type === 'cancel' ? 'claim.released' :
                                 'append';

    const eventData: Record<string, unknown> = {
      appendId: result.id,
      type: result.type,
      author,
    };

    if (result.type === 'claim') {
      eventData.taskId = result.ref;
      eventData.expiresAt = result.expiresAt;
    } else if (result.type === 'renew') {
      eventData.claimId = result.ref;
      eventData.expiresAt = result.expiresAt;
    } else if (result.type === 'response') {
      eventData.taskId = result.ref;
      eventData.content = item.content;
    } else if (result.type === 'blocked') {
      eventData.taskId = result.ref;
      eventData.reason = item.content;
    } else if (result.type === 'cancel') {
      eventData.claimId = result.ref;
    }

    emit({
      type: eventType,
      workspaceId: capKey.workspaceId,
      filePath: file.path,
      data: eventData,
      timestamp: nowIso,
    });
  }

  // Build web URL for the file using the append key
  const fileUrlPath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
  const webUrl = `${APP_URL}/a/${key}/${fileUrlPath}`;

  const response: HandleMultiAppendResult = {
    status: 201,
    body: { ok: true, serverTime: nowIso, data: { appends: results }, webUrl }
  };

  if (idempotencyKey && ownsIdempotencyClaim) {
    finalizeIdempotencyKey({
      idempotencyKey,
      status: response.status,
      body: response.body,
    });
  }

  return response;
}

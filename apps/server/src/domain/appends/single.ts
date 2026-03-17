import { eq, and, isNull } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { files } from '../../db/schema';
import { isPathWithinScope } from '../../core/path-validation';
import { logAction } from '../../services/audit';
import { triggerWebhooks } from '../../services/webhook-trigger';
import { emit, type EventType } from '../../services/event-bus';
import { LIMITS } from '@mdplane/shared';
import type { SingleAppendResult } from '@mdplane/shared';
import { serverEnv } from '../../config/env';

import {
  type AppendType,
  type HandleAppendRequestInput,
  type HandleAppendRequestResult,
  AUTHOR_PATTERN,
  RESERVED_AUTHORS,
} from './types';
import { isValidAppendType } from './validation';
import {
  claimIdempotencyKey,
  clearPendingIdempotencyKey,
  finalizeIdempotencyKey,
  getNextAppendId,
  waitForIdempotencyResult,
} from './utils';
import { handleMultiAppend } from './multi';
import {
  type AppendHandlerContext,
  isHandlerError,
} from './handlers/types';
import { handleClaim } from './handlers/claim';
import { handleResponse } from './handlers/response';
import { handleCancel, handleRenew } from './handlers/cancel-renew';
import {
  handleTask,
  handleComment,
  handleBlocked,
  handleAnswer,
  handleVote,
  handleDefault,
} from './handlers/comment-task-blocked-answer-vote';

const APP_URL = serverEnv.appUrl;

function normalizePath(path: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  decoded = decoded.replace(/\/+/g, '/');
  if (!decoded.startsWith('/')) decoded = '/' + decoded;
  if (decoded.length > 1 && decoded.endsWith('/')) decoded = decoded.slice(0, -1);
  return decoded;
}

export async function handleAppendRequest({
  key,
  path,
  body,
  idempotencyKey,
  keyResult,
}: HandleAppendRequestInput): Promise<HandleAppendRequestResult> {
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const capKey = keyResult.key;
  const normalizedRequestPath = normalizePath(path);
  if (!normalizedRequestPath) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_PATH', message: 'Invalid path encoding' } },
    };
  }

  if (!body.author) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'author is required' } } };
  }
  if (!AUTHOR_PATTERN.test(body.author)) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_AUTHOR', message: 'Invalid author format' } } };
  }
  if (RESERVED_AUTHORS.includes(body.author)) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_AUTHOR', message: 'Reserved author name' } } };
  }
  if (capKey.boundAuthor && capKey.boundAuthor !== body.author) {
    return { status: 400, body: { ok: false, error: { code: 'AUTHOR_MISMATCH', message: 'Author does not match bound author' } } };
  }

  if (capKey.scopePath) {
    if (capKey.scopeType === 'folder') {
      if (!isPathWithinScope(normalizedRequestPath, capKey.scopePath)) {
        return { status: 404, body: { ok: false, error: { code: 'PERMISSION_DENIED', message: 'Path outside of key scope' } } };
      }
    } else if (capKey.scopeType === 'file') {
      const normalizedScopePath = normalizePath(capKey.scopePath);
      if (!normalizedScopePath) {
        return {
          status: 404,
          body: { ok: false, error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' } },
        };
      }

      if (normalizedRequestPath !== normalizedScopePath) {
        return { status: 404, body: { ok: false, error: { code: 'PERMISSION_DENIED', message: 'Path outside of key scope' } } };
      }
    }
  }

  const hasAppends = Array.isArray(body.appends) && body.appends.length > 0;
  const hasSingleAppendFields = body.content || body.type || body.ref;

  if (capKey.allowedTypes) {
    const allowedTypes = JSON.parse(capKey.allowedTypes) as string[];
    if (body.type && !allowedTypes.includes(body.type)) {
      return { status: 400, body: { ok: false, error: { code: 'TYPE_NOT_ALLOWED', message: 'Append type not allowed for this key' } } };
    }
    if (hasAppends) {
      for (const item of body.appends!) {
        if (item.type && !allowedTypes.includes(item.type)) {
          return { status: 400, body: { ok: false, error: { code: 'TYPE_NOT_ALLOWED', message: 'Append type not allowed for this key' } } };
        }
      }
    }
  }

  if (!hasAppends && body.content) {
    const contentSize = new TextEncoder().encode(body.content).length;
    if (contentSize > LIMITS.APPEND_MAX_SIZE_BYTES) {
      return {
        status: 413,
        body: { ok: false, error: { code: 'PAYLOAD_TOO_LARGE', message: `Append content exceeds maximum size of ${LIMITS.APPEND_MAX_SIZE_BYTES} bytes` } },
        headers: { 'X-Content-Size-Limit': String(LIMITS.APPEND_MAX_SIZE_BYTES) }
      };
    }
  }
  if (hasAppends) {
    for (const append of body.appends!) {
      if (append.content) {
        const contentSize = new TextEncoder().encode(append.content).length;
        if (contentSize > LIMITS.APPEND_MAX_SIZE_BYTES) {
          return {
            status: 413,
            body: { ok: false, error: { code: 'PAYLOAD_TOO_LARGE', message: `Append content exceeds maximum size of ${LIMITS.APPEND_MAX_SIZE_BYTES} bytes` } },
            headers: { 'X-Content-Size-Limit': String(LIMITS.APPEND_MAX_SIZE_BYTES) }
          };
        }
      }
    }
  }

  if (hasAppends && hasSingleAppendFields) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'Cannot use both appends array and single-append fields' } } };
  }

  if (!hasAppends && body.type && !isValidAppendType(body.type)) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_APPEND_TYPE', message: 'Invalid append type' } } };
  }
  if (!hasAppends && !body.type && body.ref) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'type is required' } } };
  }
  if (!hasAppends && !body.type) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'type is required' } } };
  }

  const now = new Date(Date.now());
  const nowIso = now.toISOString();

  const file = await db.query.files.findFirst({
    where: and(eq(files.workspaceId, capKey.workspaceId), eq(files.path, normalizedRequestPath), isNull(files.deletedAt)),
  });
  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } } };
  }

  if (hasAppends) {
    return handleMultiAppend({ key, file: { id: file.id, path: normalizedRequestPath }, author: body.author, appendItems: body.appends!, capKey, idempotencyKey });
  }
  const appendType = body.type;
  if (!appendType) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'type is required' } } };
  }

  let ownsIdempotencyClaim = false;
  if (idempotencyKey) {
    const claimResult = claimIdempotencyKey({
      idempotencyKey,
      capabilityKeyId: capKey.id,
      createdAt: nowIso,
    });

    if (claimResult.kind === 'cached') {
      return { status: claimResult.cached.status, body: claimResult.cached.body };
    }

    if (claimResult.kind === 'pending') {
      const pendingResult = await waitForIdempotencyResult({ idempotencyKey });
      if (pendingResult) {
        return { status: pendingResult.status, body: pendingResult.body };
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

  try {
    const appendId = await getNextAppendId(file.id);

    const ctx: AppendHandlerContext = {
      db,
      sqlite,
      file: { id: file.id, workspaceId: file.workspaceId },
      author: body.author,
      body,
      now,
      nowIso,
      appendId,
      capKey,
    };

    let handlerResult;
    switch (appendType) {
      case 'task': handlerResult = await handleTask(ctx); break;
      case 'claim': handlerResult = await handleClaim(ctx); break;
      case 'response': handlerResult = await handleResponse(ctx); break;
      case 'cancel': handlerResult = await handleCancel(ctx); break;
      case 'comment': handlerResult = await handleComment(ctx); break;
      case 'blocked': handlerResult = await handleBlocked(ctx); break;
      case 'answer': handlerResult = await handleAnswer(ctx); break;
      case 'renew': handlerResult = await handleRenew(ctx); break;
      case 'vote': handlerResult = await handleVote(ctx); break;
      default: handlerResult = await handleDefault(ctx, appendType); break;
    }

    if (isHandlerError(handlerResult)) {
      if (idempotencyKey && ownsIdempotencyClaim) {
        clearPendingIdempotencyKey(idempotencyKey);
      }
      return { status: handlerResult.status, body: { ok: false, error: handlerResult.error } };
    }

    const responseData: SingleAppendResult = {
      id: appendId,
      type: appendType,
      author: body.author,
      ts: nowIso,
      ...handlerResult.responsePatch,
    };

    const fileUrlPath = normalizedRequestPath.startsWith('/') ? normalizedRequestPath.substring(1) : normalizedRequestPath;
    const webUrl = `${APP_URL}/a/${key}/${fileUrlPath}`;
    const response: HandleAppendRequestResult = {
      status: 201,
      body: { ok: true, serverTime: nowIso, data: responseData, webUrl },
    };

    if (idempotencyKey && ownsIdempotencyClaim) {
      finalizeIdempotencyKey({
        idempotencyKey,
        status: response.status,
        body: response.body,
      });
    }

    logAction({
      workspaceId: capKey.workspaceId,
      action: appendType === 'claim' ? 'claim' : 'append',
      resourceType: 'file',
      resourceId: file.id,
      resourcePath: normalizedRequestPath,
      actor: body.author,
      actorType: 'capability_url',
      metadata: { appendId, type: appendType, ref: body.ref },
    });

    const webhookEvent = appendType === 'task' ? 'task.created' :
                        appendType === 'claim' ? 'claim.created' :
                        appendType === 'cancel' ? 'claim.released' : 'append.created';
    triggerWebhooks(capKey.workspaceId, webhookEvent, {
      append: { id: appendId, type: appendType, author: body.author, ref: body.ref },
      file: { id: file.id, path: normalizedRequestPath },
    }, normalizedRequestPath).catch((err) => console.error('Webhook trigger failed:', err));

    const eventType: EventType = appendType === 'task' ? 'task.created' :
                                appendType === 'claim' ? 'claim.created' :
                                appendType === 'renew' ? 'claim.renewed' :
                                appendType === 'response' ? 'task.completed' :
                                appendType === 'blocked' ? 'task.blocked' :
                                appendType === 'cancel' ? 'claim.released' : 'append';

    const eventData: Record<string, unknown> = { appendId, type: appendType, author: body.author };
    if (appendType === 'claim') { eventData.taskId = body.ref; eventData.expiresAt = responseData.expiresAt; }
    else if (appendType === 'renew') { eventData.claimId = body.ref; eventData.expiresAt = responseData.expiresAt; }
    else if (appendType === 'response') { eventData.taskId = body.ref; eventData.content = body.content; }
    else if (appendType === 'blocked') { eventData.taskId = body.ref; eventData.reason = body.content; }
    else if (appendType === 'cancel') { eventData.claimId = body.ref; }
    else { eventData.content = body.content; eventData.ref = body.ref; }

    emit({ type: eventType, workspaceId: capKey.workspaceId, filePath: normalizedRequestPath, data: eventData, timestamp: nowIso });
    return response;
  } catch (error) {
    if (idempotencyKey && ownsIdempotencyClaim) {
      clearPendingIdempotencyKey(idempotencyKey);
    }
    throw error;
  }
}

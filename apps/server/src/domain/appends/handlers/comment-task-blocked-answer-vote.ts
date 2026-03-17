import { eq, and } from 'drizzle-orm';
import { appends } from '../../../db/schema';
import { generateKey } from '../../../core/capability-keys';
import type { AppendHandlerContext, AppendHandlerResult, AppendResponsePatch } from './types';

function generateId(): string {
  return generateKey(16);
}

export async function handleTask(ctx: AppendHandlerContext): Promise<AppendHandlerResult> {
  const { db, file, body, nowIso, appendId } = ctx;

  await db.insert(appends).values({
    id: generateId(),
    fileId: file.id,
    appendId,
    author: body.author,
    type: 'task',
    status: 'open',
    priority: body.priority ?? null,
    labels: body.labels ? JSON.stringify(body.labels) : null,
    dueAt: body.dueAt ?? null,
    createdAt: nowIso,
    contentPreview: body.content ?? null,
  });

  const responsePatch: AppendResponsePatch = { status: 'open' };
  if (body.priority) responsePatch.priority = body.priority;
  if (body.labels) responsePatch.labels = body.labels;
  if (body.dueAt) responsePatch.dueAt = body.dueAt;

  return { responsePatch };
}

export async function handleComment(ctx: AppendHandlerContext): Promise<AppendHandlerResult> {
  const { db, file, body, nowIso, appendId } = ctx;

  await db.insert(appends).values({
    id: generateId(),
    fileId: file.id,
    appendId,
    author: body.author,
    type: 'comment',
    ref: body.ref ?? null,
    createdAt: nowIso,
    contentPreview: body.content ?? null,
  });

  const responsePatch: AppendResponsePatch = {};
  if (body.ref) responsePatch.ref = body.ref;

  return { responsePatch };
}

export async function handleBlocked(ctx: AppendHandlerContext): Promise<AppendHandlerResult> {
  const { db, file, body, nowIso, appendId } = ctx;

  if (!body.ref) {
    return { status: 400, error: { code: 'INVALID_REQUEST', message: 'ref is required for blocked' } };
  }

  await db.insert(appends).values({
    id: generateId(),
    fileId: file.id,
    appendId,
    author: body.author,
    type: 'blocked',
    ref: body.ref,
    status: 'active',
    createdAt: nowIso,
    contentPreview: body.content ?? null,
  });

  return { responsePatch: { ref: body.ref } };
}

export async function handleAnswer(ctx: AppendHandlerContext): Promise<AppendHandlerResult> {
  const { db, file, body, nowIso, appendId } = ctx;

  if (!body.ref) {
    return { status: 400, error: { code: 'INVALID_REQUEST', message: 'ref is required for answer' } };
  }

  const refAppend = await db.query.appends.findFirst({
    where: and(eq(appends.fileId, file.id), eq(appends.appendId, body.ref)),
  });

  if (!refAppend) {
    return { status: 404, error: { code: 'APPEND_NOT_FOUND', message: 'Referenced append not found' } };
  }

  if (refAppend.type !== 'blocked') {
    return { status: 400, error: { code: 'INVALID_REF', message: 'Answer must reference a blocked append' } };
  }

  await db.insert(appends).values({
    id: generateId(),
    fileId: file.id,
    appendId,
    author: body.author,
    type: 'answer',
    ref: body.ref,
    createdAt: nowIso,
    contentPreview: body.content ?? null,
  });

  return { responsePatch: { ref: body.ref } };
}

export async function handleVote(ctx: AppendHandlerContext): Promise<AppendHandlerResult> {
  const { db, file, body, nowIso, appendId } = ctx;

  if (!body.ref) {
    return { status: 400, error: { code: 'INVALID_REQUEST', message: 'ref is required for vote' } };
  }

  if (body.value !== '+1' && body.value !== '-1') {
    return { status: 400, error: { code: 'INVALID_VOTE_VALUE', message: 'Vote value must be +1 or -1' } };
  }

  await db.insert(appends).values({
    id: generateId(),
    fileId: file.id,
    appendId,
    author: body.author,
    type: 'vote',
    ref: body.ref,
    createdAt: nowIso,
    contentPreview: body.content ?? null,
  });

  return { responsePatch: { ref: body.ref, value: body.value } };
}

export async function handleDefault(ctx: AppendHandlerContext, appendType: string | undefined): Promise<AppendHandlerResult> {
  const { db, file, body, nowIso, appendId } = ctx;

  await db.insert(appends).values({
    id: generateId(),
    fileId: file.id,
    appendId,
    author: body.author,
    type: appendType ?? null,
    createdAt: nowIso,
    contentPreview: body.content ?? null,
  });

  return { responsePatch: {} };
}

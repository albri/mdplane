import { eq, and } from 'drizzle-orm';
import { appends } from '../../../db/schema';
import { generateKey } from '../../../core/capability-keys';
import { DEFAULT_CLAIM_EXPIRY_SECONDS } from '../types';
import type { AppendHandlerContext, AppendHandlerResult } from './types';

function generateId(): string {
  return generateKey(16);
}

export async function handleCancel(ctx: AppendHandlerContext): Promise<AppendHandlerResult> {
  const { db, sqlite, file, body, nowIso, appendId } = ctx;

  if (!body.ref) {
    return { status: 400, error: { code: 'INVALID_REQUEST', message: 'ref is required for cancel' } };
  }

  const claimToCancel = await db.query.appends.findFirst({
    where: and(
      eq(appends.fileId, file.id),
      eq(appends.appendId, body.ref),
      eq(appends.type, 'claim')
    ),
  });

  if (!claimToCancel) {
    return { status: 404, error: { code: 'APPEND_NOT_FOUND', message: 'Claim not found' } };
  }

  if (claimToCancel.author !== body.author) {
    return { status: 400, error: { code: 'CANNOT_CANCEL_OTHERS_CLAIM', message: "Cannot cancel another author's claim" } };
  }

  sqlite.prepare('UPDATE appends SET status = ? WHERE id = ?').run('cancelled', claimToCancel.id);

  if (claimToCancel.ref) {
    sqlite.prepare(
      'UPDATE appends SET status = ? WHERE file_id = ? AND append_id = ? AND type = ?'
    ).run('open', file.id, claimToCancel.ref, 'task');
  }

  await db.insert(appends).values({
    id: generateId(),
    fileId: file.id,
    appendId,
    author: body.author,
    type: 'cancel',
    ref: body.ref,
    createdAt: nowIso,
  });

  return { responsePatch: { ref: body.ref, taskStatus: 'open' } };
}

export async function handleRenew(ctx: AppendHandlerContext): Promise<AppendHandlerResult> {
  const { db, sqlite, file, body, now, nowIso, appendId } = ctx;

  if (!body.ref) {
    return { status: 400, error: { code: 'INVALID_REQUEST', message: 'ref is required for renew' } };
  }

  const claimToRenew = await db.query.appends.findFirst({
    where: and(
      eq(appends.fileId, file.id),
      eq(appends.appendId, body.ref),
      eq(appends.type, 'claim')
    ),
  });

  if (!claimToRenew) {
    return { status: 404, error: { code: 'APPEND_NOT_FOUND', message: 'Claim not found' } };
  }

  if (claimToRenew.author !== body.author) {
    return { status: 400, error: { code: 'CANNOT_RENEW_OTHERS_CLAIM', message: "Cannot renew another author's claim" } };
  }

  const expiresInSeconds = body.expiresInSeconds ?? DEFAULT_CLAIM_EXPIRY_SECONDS;
  const requestedExpiresAtMs = now.getTime() + expiresInSeconds * 1000;
  const currentExpiresAtMs = claimToRenew.expiresAt ? new Date(claimToRenew.expiresAt).getTime() : Number.NEGATIVE_INFINITY;
  const newExpiresAtMs = requestedExpiresAtMs > currentExpiresAtMs ? requestedExpiresAtMs : currentExpiresAtMs + 1;
  const newExpiresAt = new Date(newExpiresAtMs).toISOString();

  sqlite.prepare('UPDATE appends SET expires_at = ? WHERE id = ?').run(newExpiresAt, claimToRenew.id);

  await db.insert(appends).values({
    id: generateId(),
    fileId: file.id,
    appendId,
    author: body.author,
    type: 'renew',
    ref: body.ref,
    expiresAt: newExpiresAt,
    createdAt: nowIso,
  });

  return { responsePatch: { ref: body.ref, expiresAt: newExpiresAt, expiresInSeconds } };
}

import { appends } from '../../../db/schema';
import { generateId } from '../utils';
import type { AppendHandlerContext, AppendHandlerResult } from './types';

export async function handleResponse(ctx: AppendHandlerContext): Promise<AppendHandlerResult> {
  const { db, sqlite, file, body, nowIso, appendId } = ctx;

  if (!body.ref) {
    return { status: 400, error: { code: 'INVALID_REQUEST', message: 'ref is required for response' } };
  }
  if (!body.content) {
    return { status: 400, error: { code: 'INVALID_REQUEST', message: 'content is required for response' } };
  }

  // Response appends intentionally allow refs to deleted tasks.

  // Release any active claim on the referenced task (no-op if none exist)
  sqlite.prepare(
    'UPDATE appends SET status = ? WHERE file_id = ? AND ref = ? AND type = ? AND status = ?'
  ).run('completed', file.id, body.ref, 'claim', 'active');

  // Set task status to done (no-op if task doesn't exist)
  sqlite.prepare(
    'UPDATE appends SET status = ? WHERE file_id = ? AND append_id = ? AND type = ?'
  ).run('done', file.id, body.ref, 'task');

  await db.insert(appends).values({
    id: generateId(),
    fileId: file.id,
    appendId,
    author: body.author,
    type: 'response',
    ref: body.ref,
    status: 'completed',
    createdAt: nowIso,
    contentPreview: body.content,
  });

  return { responsePatch: { ref: body.ref, taskStatus: 'done' } };
}

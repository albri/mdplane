import { sqlite } from '../../db';
import { generateKey, hashKey } from '../../core/capability-keys';
import { computeETag } from '../../shared';
import type {
  GetFileInput,
  GetFileResult,
  AppendToFileInput,
  AppendToFileResult,
  CreateFileInput,
  CreateFileResult,
  UpdateFileInput,
  UpdateFileResult,
  DeleteFileInput,
  DeleteFileResult,
} from './types';

type FileRecord = {
  id: string;
  path: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type FileIdRecord = { id: string; content?: string; deleted_at: string | null };
type ContentBody = { content: string };
type AppendBody = { content: string; author?: string; type?: string };

function parseContentBody(body: unknown): ContentBody | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const content = (body as Record<string, unknown>).content;
  if (typeof content !== 'string') {
    return null;
  }
  return { content };
}

function parseAppendBody(body: unknown): AppendBody | null {
  const contentBody = parseContentBody(body);
  if (!contentBody) {
    return null;
  }
  const record = body as Record<string, unknown>;
  return {
    content: contentBody.content,
    author: typeof record.author === 'string' ? record.author : undefined,
    type: typeof record.type === 'string' ? record.type : undefined,
  };
}

export function handleGetFile(input: GetFileInput): GetFileResult {
  const { key, path } = input;

  const file = sqlite
    .query(`SELECT id, path, content, created_at, updated_at, deleted_at FROM files WHERE workspace_id = ? AND path = ?`)
    .get(key.workspaceId, path) as FileRecord | null;

  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } } };
  }

  if (file.deleted_at) {
    return { status: 410, body: { ok: false, error: { code: 'GONE', message: 'File has been deleted' } } };
  }

  const filename = path.split('/').pop() || path;
  const etag = computeETag(file.content);
  const size = Buffer.byteLength(file.content, 'utf-8');

  const appendCountResult = sqlite
    .query(`SELECT COUNT(*) as count FROM appends WHERE file_id = ?`)
    .get(file.id) as { count: number } | null;
  const appendCount = appendCountResult?.count ?? 0;

  return {
    status: 200,
    body: {
      ok: true,
      data: { id: file.id, filename, content: file.content, etag, createdAt: file.created_at, updatedAt: file.updated_at, appendCount, size },
    },
    headers: { ETag: etag },
  };
}

export function handleAppendToFile(input: AppendToFileInput): AppendToFileResult {
  const { key, path, body } = input;
  const parsedBody = parseAppendBody(body);

  if (!parsedBody) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'content is required' } } };
  }

  const file = sqlite
    .query(`SELECT id, content, deleted_at FROM files WHERE workspace_id = ? AND path = ?`)
    .get(key.workspaceId, path) as FileIdRecord | null;

  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } } };
  }

  if (file.deleted_at) {
    return { status: 410, body: { ok: false, error: { code: 'GONE', message: 'File has been deleted' } } };
  }

  const now = new Date().toISOString();
  const appendCountResult = sqlite.query(`SELECT COUNT(*) as count FROM appends WHERE file_id = ?`).get(file.id) as { count: number } | null;
  const appendId = `a${(appendCountResult?.count ?? 0) + 1}`;
  const author = parsedBody.author || 'api-key';
  const appendType = parsedBody.type || 'comment';

  const recordId = generateKey(16);
  sqlite.prepare('INSERT INTO appends (id, file_id, append_id, author, type, created_at, content_preview) VALUES (?, ?, ?, ?, ?, ?, ?)').run(recordId, file.id, appendId, author, appendType, now, parsedBody.content);

  const newContent = file.content + '\n' + parsedBody.content;
  sqlite.prepare('UPDATE files SET content = ?, updated_at = ? WHERE id = ?').run(newContent, now, file.id);

  return { status: 201, body: { ok: true, data: { id: appendId, author, ts: now, type: appendType, content: parsedBody.content } } };
}

export function handleCreateOrWriteFile(input: CreateFileInput): CreateFileResult {
  const { key, path, body, baseUrl, appUrl } = input;
  const parsedBody = parseContentBody(body);

  if (!parsedBody) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'content is required' } } };
  }

  const now = new Date().toISOString();
  const filename = path.split('/').pop() || path;

  const existingFile = sqlite
    .query(`SELECT id FROM files WHERE workspace_id = ? AND path = ? AND deleted_at IS NULL`)
    .get(key.workspaceId, path) as { id: string } | null;

  if (existingFile) {
    sqlite.prepare('UPDATE files SET content = ?, updated_at = ? WHERE id = ?').run(parsedBody.content, now, existingFile.id);
    return { status: 200, body: { ok: true, data: { id: existingFile.id, filename, path, updatedAt: now } } };
  }

  const fileId = generateKey(16);
  sqlite.prepare('INSERT INTO files (id, workspace_id, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(fileId, key.workspaceId, path, parsedBody.content, now, now);

  const readKey = generateKey();
  const appendKey = generateKey();
  const writeKey = generateKey();

  const insertKeyStmt = sqlite.prepare(
    'INSERT INTO capability_keys (id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const keyData of [
    { key: readKey, permission: 'read' as const },
    { key: appendKey, permission: 'append' as const },
    { key: writeKey, permission: 'write' as const },
  ]) {
    insertKeyStmt.run(generateKey(16), key.workspaceId, keyData.key.substring(0, 4), hashKey(keyData.key), keyData.permission, 'file', path, now);
  }

  return {
    status: 201,
    body: {
      ok: true,
      data: {
        id: fileId,
        filename,
        path,
        urls: { read: `${baseUrl}/r/${readKey}`, append: `${baseUrl}/a/${appendKey}`, write: `${baseUrl}/w/${writeKey}` },
        createdAt: now,
        webUrl: `${appUrl}/r/${readKey}/${path.substring(1)}`,
      },
    },
  };
}

export function handleUpdateFile(input: UpdateFileInput): UpdateFileResult {
  const { key, path, body, ifMatchHeader, appUrl } = input;
  const parsedBody = parseContentBody(body);

  if (!parsedBody) {
    return { status: 400, body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'content is required' } } };
  }

  const file = sqlite
    .query(`SELECT id, content, deleted_at FROM files WHERE workspace_id = ? AND path = ?`)
    .get(key.workspaceId, path) as FileIdRecord | null;

  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } } };
  }

  if (file.deleted_at) {
    return { status: 410, body: { ok: false, error: { code: 'GONE', message: 'File has been deleted' } } };
  }

  if (ifMatchHeader) {
    const currentEtag = computeETag(file.content!);
    const providedEtag = ifMatchHeader.replace(/^"|"$/g, '');
    if (providedEtag !== currentEtag) {
      return {
        status: 412,
        body: { ok: false, error: { code: 'CONFLICT', message: 'File was modified since last read', details: { currentEtag, providedEtag } } },
      };
    }
  }

  const now = new Date().toISOString();
  const newEtag = computeETag(parsedBody.content);
  const size = Buffer.byteLength(parsedBody.content, 'utf-8');

  const staleResult = sqlite
    .query(`SELECT COUNT(*) as count FROM appends WHERE file_id = ? AND content_hash IS NOT NULL AND content_hash != ?`)
    .get(file.id, newEtag) as { count: number } | null;
  const appendsStale = staleResult?.count ?? 0;

  sqlite.prepare('UPDATE files SET content = ?, updated_at = ? WHERE id = ?').run(parsedBody.content, now, file.id);

  return {
    status: 200,
    body: { ok: true, data: { id: file.id, etag: newEtag, updatedAt: now, size, appendsStale, webUrl: `${appUrl}/control/${key.workspaceId}` } },
    headers: { ETag: newEtag },
  };
}

export function handleDeleteFile(input: DeleteFileInput): DeleteFileResult {
  const { key, path, permanent } = input;

  const file = sqlite
    .query(`SELECT id, deleted_at FROM files WHERE workspace_id = ? AND path = ?`)
    .get(key.workspaceId, path) as { id: string; deleted_at: string | null } | null;

  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } } };
  }

  if (file.deleted_at) {
    return { status: 410, body: { ok: false, error: { code: 'GONE', message: 'File has already been deleted' } } };
  }

  if (permanent) {
    sqlite.prepare('DELETE FROM files WHERE id = ?').run(file.id);
    return { status: 200, body: { ok: true, data: { id: file.id, deleted: true, recoverable: false } } };
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  sqlite.prepare('UPDATE files SET deleted_at = ? WHERE id = ?').run(now, file.id);

  return { status: 200, body: { ok: true, data: { id: file.id, deleted: true, recoverable: true, expiresAt } } };
}

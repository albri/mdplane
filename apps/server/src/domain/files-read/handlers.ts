import { and, eq, isNull } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { files } from '../../db/schema';
import {
  computeETag,
  findFileForScope,
  validateAndGetFileKey,
} from '../../shared';
import { serverEnv } from '../../config/env';
import type {
  ReadMetaResult,
  ReadRawResult,
  ReadSectionResult,
  ReadStructureResult,
  ReadTailResult,
} from './types';

const APP_URL = serverEnv.appUrl;

function createFileDeletedResult(deletedAt: string) {
  const deletedDate = new Date(deletedAt);
  const expiresAt = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const recoverable = Date.now() - deletedDate.getTime() < 7 * 24 * 60 * 60 * 1000;

  return {
    status: 410,
    headers: { 'Content-Type': 'application/json', 'X-Deleted-At': deletedAt },
    body: {
      ok: false,
      error: {
        code: 'FILE_DELETED',
        message: 'File is soft-deleted',
        details: {
          recoverable,
          expiresAt,
        },
      },
    },
  } as const;
}

export async function handleReadSection(input: {
  key: string;
  encodedHeading: string;
}): Promise<ReadSectionResult> {
  const keyResult = await validateAndGetFileKey({ keyString: input.key });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  let file;
  if (keyResult.key.scopeType === 'file' && keyResult.key.scopePath) {
    file = await db.query.files.findFirst({
      where: and(eq(files.workspaceId, keyResult.key.workspaceId), eq(files.path, keyResult.key.scopePath)),
    });
  } else {
    file = await db.query.files.findFirst({
      where: and(eq(files.workspaceId, keyResult.key.workspaceId), isNull(files.deletedAt)),
      orderBy: (f, { asc }) => [asc(f.createdAt), asc(f.path)],
    });
  }

  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } } };
  }

  if (file.deletedAt) {
    return createFileDeletedResult(file.deletedAt);
  }

  const targetHeading = decodeURIComponent(input.encodedHeading);
  const lines = file.content.split('\n');

  let headingLine = -1;
  let headingLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match && match[2].trim() === targetHeading) {
      headingLine = i;
      headingLevel = match[1].length;
      break;
    }
  }

  if (headingLine === -1) {
    return {
      status: 404,
      body: {
        ok: false,
        error: { code: 'SECTION_NOT_FOUND', message: `Heading "${targetHeading}" not found` },
      },
    };
  }

  let endLine = lines.length - 1;
  for (let i = headingLine + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+/);
    if (match && match[1].length <= headingLevel) {
      endLine = i - 1;
      break;
    }
  }

  const sectionContent = lines.slice(headingLine, endLine + 1).join('\n');

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      ok: true,
      data: {
        heading: targetHeading,
        level: headingLevel,
        content: sectionContent,
        startLine: headingLine + 1,
        endLine: endLine + 1,
      },
    },
  };
}

export async function handleReadMeta(input: { key: string }): Promise<ReadMetaResult> {
  const keyResult = await validateAndGetFileKey({ keyString: input.key });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const file = await findFileForScope({
    workspaceId: keyResult.key.workspaceId,
    capKey: keyResult.key,
    options: { includeDeleted: true },
  });

  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } } };
  }

  if (file.deletedAt) {
    return createFileDeletedResult(file.deletedAt);
  }

  const size = Buffer.byteLength(file.content, 'utf-8');
  const pathParts = file.path.split('/');
  const filename = pathParts.pop() || file.path;
  const folder = pathParts.join('/') || '/';

  const appendCountResult = sqlite.query(
    'SELECT COUNT(*) as count FROM appends WHERE file_id = ?'
  ).get(file.id) as { count: number };
  const taskStatsResult = sqlite.query(`
      SELECT
        SUM(CASE WHEN type = 'task' AND (status IS NULL OR status = 'pending') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN type = 'task' AND status = 'claimed' THEN 1 ELSE 0 END) as claimed,
        SUM(CASE WHEN type = 'task' AND status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM appends WHERE file_id = ?
    `).get(file.id) as { pending: number; claimed: number; completed: number };

  const webhookResult = sqlite.query(`
      SELECT COUNT(*) as count FROM webhooks
      WHERE workspace_id = ? AND deleted_at IS NULL AND disabled_at IS NULL
        AND (scope_type = 'workspace' OR (scope_type = 'file' AND scope_path = ?) OR (scope_type = 'folder' AND ? LIKE scope_path || '%'))
    `).get(keyResult.key.workspaceId, file.path, file.path) as { count: number };

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      ok: true,
      data: {
        id: file.id,
        filename,
        folder,
        size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        appendCount: appendCountResult?.count ?? 0,
        taskStats: {
          pending: taskStatsResult?.pending ?? 0,
          claimed: taskStatsResult?.claimed ?? 0,
          completed: taskStatsResult?.completed ?? 0,
        },
        hasWebhook: (webhookResult?.count ?? 0) > 0,
        webUrl: `${APP_URL}/r/${input.key}`,
      },
    },
  };
}

export async function handleReadRaw(input: { key: string }): Promise<ReadRawResult> {
  const keyResult = await validateAndGetFileKey({ keyString: input.key });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const file = await findFileForScope({
    workspaceId: keyResult.key.workspaceId,
    capKey: keyResult.key,
    options: { includeDeleted: true },
  });

  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } } };
  }

  if (file.deletedAt) {
    return createFileDeletedResult(file.deletedAt);
  }

  return {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown',
      ETag: computeETag(file.content),
    },
    body: file.content,
  };
}

export async function handleReadStructure(input: { key: string }): Promise<ReadStructureResult> {
  const keyResult = await validateAndGetFileKey({ keyString: input.key });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const file = await findFileForScope({
    workspaceId: keyResult.key.workspaceId,
    capKey: keyResult.key,
    options: { includeDeleted: true },
  });

  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } } };
  }

  if (file.deletedAt) {
    return createFileDeletedResult(file.deletedAt);
  }

  const lines = file.content.split('\n');
  const headings: Array<{ level: number; text: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim(), line: i + 1 });
    }
  }

  const appendStats = sqlite.query(`
      SELECT
        COUNT(*) as appendCount,
        SUM(CASE WHEN type = 'task' THEN 1 ELSE 0 END) as taskAppends
      FROM appends WHERE file_id = ?
    `).get(file.id) as { appendCount: number; taskAppends: number } | null;

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      ok: true,
      data: {
        headings,
        appendCount: appendStats?.appendCount ?? 0,
        hasTaskAppends: (appendStats?.taskAppends ?? 0) > 0,
      },
    },
  };
}

export async function handleReadTail(input: {
  key: string;
  bytes: number;
  lines?: number;
}): Promise<ReadTailResult> {
  const keyResult = await validateAndGetFileKey({ keyString: input.key });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const file = await findFileForScope({
    workspaceId: keyResult.key.workspaceId,
    capKey: keyResult.key,
    options: { includeDeleted: true },
  });

  if (!file) {
    return { status: 404, body: { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } } };
  }

  if (file.deletedAt) {
    return createFileDeletedResult(file.deletedAt);
  }

  const content = file.content;
  const totalBytes = Buffer.byteLength(content, 'utf-8');
  const lineLimit = input.lines;

  let tailContent: string;
  let truncated: boolean;

  if (lineLimit !== undefined) {
    const lineCount = Math.min(lineLimit, 1000);
    const allLines = content.split('\n');
    tailContent = allLines.slice(-lineCount).join('\n');
    truncated = allLines.length > lineCount;
  } else if (totalBytes <= input.bytes) {
    tailContent = content;
    truncated = false;
  } else {
    const buffer = Buffer.from(content, 'utf-8');
    tailContent = buffer.slice(-input.bytes).toString('utf-8');
    truncated = true;
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      ok: true,
      data: {
        content: tailContent,
        bytesReturned: Buffer.byteLength(tailContent, 'utf-8'),
        truncated,
      },
    },
  };
}

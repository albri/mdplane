import { eq, and, isNull, like } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { files, folders } from '../../db/schema';
import { validatePath, normalizeFolderPath } from '../../core/path-validation';
import type { HandlerResponse, ElysiaContextSet } from '../../shared';
import { detectPossibleTraversal } from '../../shared';
import type { FolderClaimItem, ListFolderContentsQuery } from '@mdplane/shared';
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared';
import { serverEnv } from '../../config/env';
import { validateAndGetKey } from './validation';

const APP_URL = serverEnv.appUrl;

type HandleListFolderClaimsInput = {
  key: string;
  folderPathParam: string;
  author?: string;
};

export async function handleListFolderClaims({
  key, folderPathParam, author,
}: HandleListFolderClaimsInput): Promise<HandlerResponse> {
  const pathError = validatePath(folderPathParam);
  if (pathError) {
    return { status: 400, body: { ok: false, error: pathError } };
  }

  const keyResult = await validateAndGetKey({
    keyString: key,
    pathHint: folderPathParam,
    requiredPermission: 'append',
  });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const folderPath = normalizeFolderPath(folderPathParam);
  const now = new Date();
  const nowIso = now.toISOString();
  const pathPattern = folderPath === '/' ? '%' : folderPath + '%';

  const folderFilesResult = sqlite
    .prepare(
      `SELECT id, path FROM files
       WHERE workspace_id = ?
       AND path LIKE ?
       AND deleted_at IS NULL`
    )
    .all(keyResult.key.workspaceId, pathPattern) as Array<{ id: string; path: string }>;

  if (folderFilesResult.length === 0) {
    return { status: 200, body: { ok: true, data: { claims: [], count: 0 } } };
  }

  const fileMap = new Map<string, string>();
  for (const file of folderFilesResult) {
    fileMap.set(file.id, file.path);
  }

  const fileIds = folderFilesResult.map(f => f.id);
  const placeholders = fileIds.map(() => '?').join(', ');
  const queryParams: string[] = [...fileIds];

  let claimQuery = `
    SELECT
      c.id as claim_db_id,
      c.append_id as claim_append_id,
      c.ref as task_id,
      c.author,
      c.expires_at,
      c.file_id,
      t.content_preview as task_content
    FROM appends c
    LEFT JOIN appends t ON t.file_id = c.file_id AND t.append_id = c.ref
    WHERE c.file_id IN (${placeholders})
      AND c.type = 'claim'
  `;

  if (author) {
    claimQuery += ` AND c.author = ?`;
    queryParams.push(author);
  }

  claimQuery += ` ORDER BY c.created_at DESC`;

  const claimRows = sqlite.prepare(claimQuery).all(...queryParams) as Array<{
    claim_db_id: string;
    claim_append_id: string;
    task_id: string;
    author: string;
    expires_at: string | null;
    file_id: string;
    task_content: string | null;
  }>;

  const claims: FolderClaimItem[] = [];

  for (const row of claimRows) {
    const filePath = fileMap.get(row.file_id);
    if (!filePath) continue;

    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    const isExpired = expiresAt ? expiresAt < now : true;
    const expiresInSeconds = expiresAt
      ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
      : 0;

    claims.push({
      taskId: row.task_id || '',
      claimId: row.claim_append_id,
      file: { id: row.file_id, path: filePath },
      taskContent: row.task_content || '',
      status: isExpired ? 'expired' : 'active',
      expiresAt: row.expires_at || nowIso,
      expiresInSeconds,
    });
  }

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        claims,
        count: claims.length,
        webUrl: `${APP_URL}${CONTROL_FRONTEND_ROUTES.orchestration(keyResult.key.workspaceId)}`,
      },
    },
  };
}

type HandleFolderExportInput = {
  key: string;
  pathParam: string;
  query: ListFolderContentsQuery;
  set: ElysiaContextSet;
  rawUrl: string;
};

export async function handleFolderExport({
  key, pathParam, query, set, rawUrl,
}: HandleFolderExportInput): Promise<Buffer | object> {
  if (detectPossibleTraversal({ rawUrl, key, pathParam })) {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  }

  const pathError = validatePath(pathParam);
  if (pathError) {
    set.status = 400;
    return { ok: false, error: pathError };
  }

  const keyResult = await validateAndGetKey({ keyString: key, pathHint: pathParam });
  if (!keyResult.ok) {
    set.status = keyResult.status;
    return { ok: false, error: keyResult.error };
  }

  const { format = 'zip' } = query;
  const recursive = query.recursive === 'true';
  const includeAppends = query.includeAppends === 'true';

  const folderPath = normalizeFolderPath(pathParam);
  const folderPathNoSlash = folderPath.endsWith('/') && folderPath !== '/'
    ? folderPath.slice(0, -1)
    : folderPath === '/' ? '' : folderPath;

  let allFiles;
  if (recursive || folderPath === '/') {
    allFiles = await db.query.files.findMany({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        isNull(files.deletedAt),
        folderPath === '/' ? undefined : like(files.path, folderPath + '%')
      ),
      columns: { id: true, path: true, content: true, createdAt: true, updatedAt: true },
    });
  } else {
    allFiles = await db.query.files.findMany({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        isNull(files.deletedAt),
        like(files.path, folderPath + '%')
      ),
      columns: { id: true, path: true, content: true, createdAt: true, updatedAt: true },
    });
    allFiles = allFiles.filter((f) => {
      const relativePath = f.path.substring(folderPath.length);
      return !relativePath.includes('/');
    });
  }

  if (folderPath !== '/' && allFiles.length === 0) {
    const explicitFolder = await db.query.folders.findFirst({
      where: and(
        eq(folders.workspaceId, keyResult.key.workspaceId),
        eq(folders.path, folderPathNoSlash),
        isNull(folders.deletedAt)
      ),
    });
    if (!explicitFolder) {
      set.status = 404;
      return { ok: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } };
    }
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    consistency: 'eventual',
    folderPath: folderPath,
    recursive,
    includeAppends,
    files: allFiles.map(f => ({
      path: f.path.startsWith('/') ? f.path.substring(1) : f.path,
      sha256: new Bun.CryptoHasher('sha256').update(f.content).digest('hex'),
      size: Buffer.byteLength(f.content, 'utf-8'),
      modifiedAt: f.updatedAt,
    })),
  };

  const archiveContent = JSON.stringify({ manifest, files: allFiles.map(f => ({
    path: f.path,
    content: f.content,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  })) }, null, 2);
  const contentBuffer = Buffer.from(archiveContent, 'utf-8');
  const checksum = new Bun.CryptoHasher('sha256').update(contentBuffer).digest('hex');

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const folderName = folderPath === '/'
    ? 'root'
    : folderPath.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '-') || 'folder';

  const contentType = format === 'zip' ? 'application/zip' : 'application/gzip';
  const filename = `folder-export-${folderName}-${dateStr}.${format}`;

  set.status = 200;
  set.headers['Content-Type'] = contentType;
  set.headers['Content-Disposition'] = `attachment; filename="${filename}"`;
  set.headers['X-Export-Checksum'] = `sha256:${checksum}`;

  return contentBuffer;
}

const SYSTEM_PATH_INDICATORS = ['etc', 'passwd', 'shadow', 'hosts', 'root', 'var', 'usr', 'bin', 'proc', 'sys', 'dev'];

export function createTraversalHandler(prefix: string) {
  return ({ params, set }: { params: Record<string, string>; set: { status: number } }) => {
    const path = params['*'] || params.path || '';
    const firstSegment = path.split('/')[0].toLowerCase();

    if (SYSTEM_PATH_INDICATORS.includes(firstSegment)) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
    }

    set.status = 404;
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } };
  };
}

import { eq, and, isNull, like } from 'drizzle-orm';
import { db } from '../../db';
import { files, folders, idempotencyKeys } from '../../db/schema';
import { validatePath, normalizeFolderPath } from '../../core/path-validation';
import { logAction } from '../../services/audit';
import type { HandlerResponse } from '../../shared';
import { generateRecordId, validateFolderName } from '../../shared';
import type { FolderCreateRequest, FolderRenameRequest, FolderMoveResponse, Error as ApiError } from '@mdplane/shared';
import { serverEnv } from '../../config/env';
import { validateAndGetKey } from './validation';

const BASE_URL = serverEnv.baseUrl;
const APP_URL = serverEnv.appUrl;

type HandleCreateFolderInput = {
  key: string;
  body: FolderCreateRequest;
  request: Request;
  idempotencyKey?: string | null;
};

export async function handleCreateFolder({
  key, body, request, idempotencyKey = null,
}: HandleCreateFolderInput): Promise<HandlerResponse> {
  const keyResult = await validateAndGetKey({ keyString: key, requiredPermission: 'write' });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  if (idempotencyKey) {
    const existing = await db.query.idempotencyKeys.findFirst({
      where: eq(idempotencyKeys.key, idempotencyKey),
    });
    if (existing) {
      return {
        status: existing.responseStatus,
        body: JSON.parse(existing.responseBody),
        headers: { 'Idempotency-Replayed': 'true' },
      };
    }
  }

  const { name, path: parentPath = '' } = body;
  const nameError = validateFolderName(name);
  if (nameError) {
    return { status: 400, body: { ok: false, error: nameError } };
  }

  if (parentPath) {
    const pathError = validatePath(parentPath);
    if (pathError) {
      return { status: 400, body: { ok: false, error: pathError } };
    }
  }

  let normalizedParent = parentPath || '/';
  if (!normalizedParent.startsWith('/')) normalizedParent = '/' + normalizedParent;
  if (normalizedParent !== '/' && normalizedParent.endsWith('/')) {
    normalizedParent = normalizedParent.slice(0, -1);
  }

  const fullPath = normalizedParent === '/' ? `/${name}` : `${normalizedParent}/${name}`;
  const folderPathWithSlash = fullPath + '/';
  const now = new Date().toISOString();

  const existingFolder = await db.query.folders.findFirst({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      eq(folders.path, fullPath),
      isNull(folders.deletedAt)
    ),
  });

  if (existingFolder) {
    return {
      status: 409,
      body: { ok: false, error: { code: 'FOLDER_ALREADY_EXISTS', message: `Folder '${fullPath}' already exists` } },
    };
  }

  const filesInFolder = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      isNull(files.deletedAt),
      like(files.path, folderPathWithSlash + '%')
    ),
  });

  if (filesInFolder) {
    return {
      status: 409,
      body: { ok: false, error: { code: 'FOLDER_ALREADY_EXISTS', message: `Folder '${fullPath}' already exists` } },
    };
  }

  const folderId = generateRecordId();
  await db.insert(folders).values({
    id: folderId,
    workspaceId: keyResult.key.workspaceId,
    path: fullPath,
    createdAt: now,
  });

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'folder.create',
    resourceType: 'folder',
    resourceId: fullPath,
    resourcePath: fullPath,
    actorType: 'capability_url',
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  const folderUrlPath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;
  const responseBody = {
    ok: true,
    data: {
      path: fullPath,
      urls: {
        read: `${BASE_URL}/r/${key}/folders/${folderUrlPath}`,
        append: `${BASE_URL}/a/${key}/folders/${folderUrlPath}`,
        write: `${BASE_URL}/w/${key}/folders/${folderUrlPath}`,
      },
      webUrl: `${APP_URL}/r/${key}/folders/${folderUrlPath}`,
      createdAt: now,
    },
  };

  if (idempotencyKey) {
    await db.insert(idempotencyKeys).values({
      key: idempotencyKey,
      capabilityKeyId: keyResult.key.id,
      responseStatus: 201,
      responseBody: JSON.stringify(responseBody),
      createdAt: now,
    }).onConflictDoNothing();
  }

  return { status: 201, body: responseBody };
}

type HandleRenameFolderInput = {
  key: string;
  folderPathParam: string;
  body: FolderRenameRequest;
  request: Request;
  idempotencyKey?: string | null;
};

export async function handleRenameFolder({
  key, folderPathParam, body, request, idempotencyKey = null,
}: HandleRenameFolderInput): Promise<HandlerResponse<FolderMoveResponse | ApiError>> {
  const pathError = validatePath(folderPathParam);
  if (pathError) {
    return { status: 400, body: { ok: false, error: pathError } };
  }

  const keyResult = await validateAndGetKey({
    keyString: key,
    pathHint: folderPathParam,
    requiredPermission: 'write',
  });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  if (idempotencyKey) {
    const existing = await db.query.idempotencyKeys.findFirst({
      where: eq(idempotencyKeys.key, idempotencyKey),
    });
    if (existing) {
      return {
        status: existing.responseStatus,
        body: JSON.parse(existing.responseBody),
        headers: { 'Idempotency-Replayed': 'true' },
      };
    }
  }

  const { name: newName } = body;
  const nameError = validateFolderName(newName);
  if (nameError) {
    return { status: 400, body: { ok: false, error: nameError } };
  }

  const folderPath = normalizeFolderPath(folderPathParam);
  const folderPathNoSlash = folderPath.endsWith('/') && folderPath !== '/'
    ? folderPath.slice(0, -1)
    : folderPath === '/' ? '' : folderPath;

  if (folderPath === '/') {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'Cannot rename root folder' } },
    };
  }

  const existingFiles = await db.query.files.findMany({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      isNull(files.deletedAt),
      like(files.path, folderPath + '%')
    ),
    columns: { id: true, path: true },
  });

  const explicitFolder = await db.query.folders.findFirst({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      eq(folders.path, folderPathNoSlash),
      isNull(folders.deletedAt)
    ),
  });

  const childFolders = await db.query.folders.findMany({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      isNull(folders.deletedAt),
      like(folders.path, folderPathNoSlash + '/%')
    ),
    columns: { id: true, path: true },
  });

  if (existingFiles.length === 0 && !explicitFolder) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } },
    };
  }

  const previousPath = folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;
  const parentDir = previousPath.substring(0, previousPath.lastIndexOf('/')) || '/';
  const newPath = parentDir === '/' ? `/${newName}` : `${parentDir}/${newName}`;
  const newFolderPath = newPath + '/';

  const targetExplicitFolder = await db.query.folders.findFirst({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      eq(folders.path, newPath),
      isNull(folders.deletedAt)
    ),
  });

  if (targetExplicitFolder) {
    return {
      status: 409,
      body: { ok: false, error: { code: 'FOLDER_ALREADY_EXISTS', message: `Folder '${newPath}' already exists` } },
    };
  }

  const targetVirtualFolder = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      isNull(files.deletedAt),
      like(files.path, newFolderPath + '%')
    ),
  });

  if (targetVirtualFolder) {
    return {
      status: 409,
      body: { ok: false, error: { code: 'FOLDER_ALREADY_EXISTS', message: `Folder '${newPath}' already exists` } },
    };
  }

  const now = new Date().toISOString();

  for (const file of existingFiles) {
    const newFilePath = file.path.replace(folderPath, newFolderPath);
    await db.update(files).set({ path: newFilePath, updatedAt: now }).where(eq(files.id, file.id));
  }

  if (explicitFolder) {
    await db.update(folders).set({ path: newPath }).where(eq(folders.id, explicitFolder.id));
  }

  for (const childFolder of childFolders) {
    const newChildPath = childFolder.path.replace(folderPathNoSlash, newPath);
    await db.update(folders).set({ path: newChildPath }).where(eq(folders.id, childFolder.id));
  }

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'folder.rename',
    resourceType: 'folder',
    resourceId: previousPath,
    resourcePath: previousPath,
    actorType: 'capability_url',
    metadata: { newPath },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  const folderUrlPath = newPath.startsWith('/') ? newPath.substring(1) : newPath;
  const webUrl = `${APP_URL}/w/${key}/folders/${folderUrlPath}`;

  const responseBody: FolderMoveResponse = {
    ok: true as const,
    data: { previousPath, newPath, webUrl },
  };

  if (idempotencyKey) {
    await db.insert(idempotencyKeys).values({
      key: idempotencyKey,
      capabilityKeyId: keyResult.key.id,
      responseStatus: 200,
      responseBody: JSON.stringify(responseBody),
      createdAt: now,
    }).onConflictDoNothing();
  }

  return { status: 200, body: responseBody };
}

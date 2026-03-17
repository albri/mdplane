import { eq, and, isNull, like } from 'drizzle-orm';
import { db } from '../../db';
import { files, folders, idempotencyKeys, capabilityKeys } from '../../db/schema';
import { validatePath, normalizeFolderPath } from '../../core/path-validation';
import { logAction } from '../../services/audit';
import type { HandlerResponse } from '../../shared';
import { validateFolderName } from '../../shared';
import type { FolderDeleteRequest, FolderDeleteResponse, FolderMoveRequest, FolderMoveResponse, Error as ApiError } from '@mdplane/shared';
import { serverEnv } from '../../config/env';
import { validateAndGetKey, normalizeMovePath } from './validation';

const APP_URL = serverEnv.appUrl;

type HandleDeleteFolderInput = {
  key: string;
  folderPathParam: string;
  body: FolderDeleteRequest | undefined;
  request: Request;
  idempotencyKey?: string | null;
};

export async function handleDeleteFolder({
  key, folderPathParam, body, request, idempotencyKey = null,
}: HandleDeleteFolderInput): Promise<HandlerResponse<FolderDeleteResponse | ApiError>> {
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

  const folderPath = normalizeFolderPath(folderPathParam);
  const folderPathNoSlash = folderPath.endsWith('/') && folderPath !== '/'
    ? folderPath.slice(0, -1)
    : folderPath === '/' ? '' : folderPath;

  if (folderPath === '/') {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'Cannot delete root folder' } },
    };
  }

  const pathForResponse = folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;

  const folderFiles = await db.query.files.findMany({
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

  if (folderFiles.length === 0 && !explicitFolder) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } },
    };
  }

  const subfolders = new Set<string>();
  let directFileCount = 0;

  for (const file of folderFiles) {
    const relativePath = file.path.substring(folderPath.length);
    if (relativePath.includes('/')) {
      const subfolder = relativePath.split('/')[0];
      subfolders.add(subfolder);
    } else {
      directFileCount++;
    }
  }

  const folderCount = subfolders.size;
  const fileCount = folderFiles.length;
  const cascadeOptions = body ?? { cascade: false };

  if (fileCount > 0 && !cascadeOptions.cascade) {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: 'FOLDER_NOT_EMPTY',
          message: `Folder contains ${fileCount} files and ${folderCount} subfolders`,
          details: { fileCount, folderCount },
        },
      },
    };
  }

  const now = new Date().toISOString();

  if (cascadeOptions.cascade && fileCount > 0) {
    const expectedConfirmPath = pathForResponse.startsWith('/')
      ? pathForResponse.substring(1)
      : pathForResponse;

    if (cascadeOptions.confirmPath !== expectedConfirmPath) {
      return {
        status: 400,
        body: {
          ok: false,
          error: {
            code: 'CONFIRM_PATH_MISMATCH',
            message: `confirmPath '${cascadeOptions.confirmPath || ''}' does not match folder path '${expectedConfirmPath}'`,
          },
        },
      };
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const file of folderFiles) {
      await db.update(files).set({ deletedAt: now, updatedAt: now }).where(eq(files.id, file.id));
    }

    if (explicitFolder) {
      await db.update(folders).set({ deletedAt: now }).where(eq(folders.id, explicitFolder.id));
    }

    for (const childFolder of childFolders) {
      await db.update(folders).set({ deletedAt: now }).where(eq(folders.id, childFolder.id));
    }

    logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'folder.delete',
      resourceType: 'folder',
      resourceId: pathForResponse,
      resourcePath: pathForResponse,
      actorType: 'capability_url',
      metadata: { cascade: true, filesDeleted: fileCount, foldersDeleted: folderCount },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    const cascadeResponseBody: FolderDeleteResponse = {
      ok: true as const,
      data: {
        path: pathForResponse,
        deleted: true as const,
        filesDeleted: fileCount,
        foldersDeleted: folderCount,
        recoverable: true,
        expiresAt,
      },
    };

    if (idempotencyKey) {
      await db.insert(idempotencyKeys).values({
        key: idempotencyKey,
        capabilityKeyId: keyResult.key.id,
        responseStatus: 200,
        responseBody: JSON.stringify(cascadeResponseBody),
        createdAt: now,
      }).onConflictDoNothing();
    }

    return { status: 200, body: cascadeResponseBody };
  }

  if (explicitFolder) {
    await db.update(folders).set({ deletedAt: now }).where(eq(folders.id, explicitFolder.id));
  }

  for (const childFolder of childFolders) {
    await db.update(folders).set({ deletedAt: now }).where(eq(folders.id, childFolder.id));
  }

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'folder.delete',
    resourceType: 'folder',
    resourceId: pathForResponse,
    resourcePath: pathForResponse,
    actorType: 'capability_url',
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  const emptyFolderResponseBody: FolderDeleteResponse = {
    ok: true as const,
    data: { path: pathForResponse, deleted: true as const },
  };

  if (idempotencyKey) {
    await db.insert(idempotencyKeys).values({
      key: idempotencyKey,
      capabilityKeyId: keyResult.key.id,
      responseStatus: 200,
      responseBody: JSON.stringify(emptyFolderResponseBody),
      createdAt: now,
    }).onConflictDoNothing();
  }

  return { status: 200, body: emptyFolderResponseBody };
}

type HandleMoveFolderInput = {
  key: string;
  sourcePathParam: string;
  body: FolderMoveRequest;
  request: Request;
  idempotencyKey?: string | null;
};

export async function handleMoveFolder({
  key, sourcePathParam, body, request, idempotencyKey = null,
}: HandleMoveFolderInput): Promise<HandlerResponse<FolderMoveResponse | ApiError>> {
  const sourcePathError = validatePath(sourcePathParam);
  if (sourcePathError) {
    return { status: 400, body: { ok: false, error: sourcePathError } };
  }

  const destPathError = validatePath(body.destination);
  if (destPathError) {
    return { status: 400, body: { ok: false, error: destPathError } };
  }

  const keyResult = await validateAndGetKey({
    keyString: key,
    pathHint: sourcePathParam,
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

  const normalizedSource = normalizeMovePath(sourcePathParam);
  const normalizedDest = normalizeMovePath(body.destination);

  if (normalizedSource === '/') {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_PATH', message: 'Cannot move root folder' } },
    };
  }

  if (normalizedSource === normalizedDest) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_PATH', message: 'Source and destination are the same' } },
    };
  }

  if (normalizedDest.startsWith(normalizedSource + '/')) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_PATH', message: 'Cannot move folder into itself' } },
    };
  }

  const sourcePattern = normalizedSource + '/%';
  const sourceFiles = await db.query.files.findMany({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      like(files.path, sourcePattern),
      isNull(files.deletedAt)
    ),
    columns: { id: true, path: true },
  });

  const explicitFolder = await db.query.folders.findFirst({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      eq(folders.path, normalizedSource),
      isNull(folders.deletedAt)
    ),
  });

  if (sourceFiles.length === 0 && !explicitFolder) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Source folder not found or empty' } },
    };
  }

  const destPattern = normalizedDest + '/%';
  const destFiles = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      like(files.path, destPattern),
      isNull(files.deletedAt)
    ),
  });

  const destExplicitFolder = await db.query.folders.findFirst({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      eq(folders.path, normalizedDest),
      isNull(folders.deletedAt)
    ),
  });

  if (destFiles || destExplicitFolder) {
    return {
      status: 409,
      body: { ok: false, error: { code: 'FOLDER_EXISTS', message: 'Destination folder already exists' } },
    };
  }

  const now = new Date().toISOString();
  let filesUpdated = 0;

  for (const file of sourceFiles) {
    const newPath = normalizedDest + file.path.substring(normalizedSource.length);
    await db.update(files).set({ path: newPath, updatedAt: now }).where(eq(files.id, file.id));
    await db.update(capabilityKeys).set({ scopePath: newPath }).where(
      and(eq(capabilityKeys.workspaceId, keyResult.key.workspaceId), eq(capabilityKeys.scopePath, file.path))
    );
    filesUpdated++;
  }

  if (explicitFolder) {
    await db.update(folders).set({ path: normalizedDest }).where(eq(folders.id, explicitFolder.id));
  }

  const childFolders = await db.query.folders.findMany({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      like(folders.path, normalizedSource + '/%'),
      isNull(folders.deletedAt)
    ),
    columns: { id: true, path: true },
  });

  for (const childFolder of childFolders) {
    const newPath = normalizedDest + childFolder.path.substring(normalizedSource.length);
    await db.update(folders).set({ path: newPath }).where(eq(folders.id, childFolder.id));
  }

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'folder.move',
    resourceType: 'folder',
    resourceId: normalizedSource,
    resourcePath: normalizedSource,
    actorType: 'capability_url',
    metadata: { previousPath: normalizedSource, newPath: normalizedDest, filesUpdated },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  const destFolderUrlPath = normalizedDest.startsWith('/') ? normalizedDest.substring(1) : normalizedDest;
  const webUrl = `${APP_URL}/w/${key}/folders/${destFolderUrlPath}`;

  const responseBody: FolderMoveResponse = {
    ok: true as const,
    data: { previousPath: normalizedSource, newPath: normalizedDest, filesUpdated, webUrl },
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

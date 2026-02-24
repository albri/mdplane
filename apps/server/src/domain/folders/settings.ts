import { eq, and, isNull, like } from 'drizzle-orm';
import { db } from '../../db';
import { files, folders } from '../../db/schema';
import { validatePath, normalizeFolderPath } from '../../core/path-validation';
import { logAction } from '../../services/audit';
import type { HandlerResponse } from '../../shared';
import { generateRecordId } from '../../shared';
import type { FolderSettings, FolderSettingsUpdateRequest } from '@mdplane/shared';
import { validateAndGetKey, parseStoredSettings } from './validation';

type HandleGetFolderSettingsInput = {
  key: string;
  folderPathParam: string;
};

export async function handleGetFolderSettings({
  key,
  folderPathParam,
}: HandleGetFolderSettingsInput): Promise<HandlerResponse> {
  if (folderPathParam) {
    const pathError = validatePath(folderPathParam);
    if (pathError) {
      return { status: 400, body: { ok: false, error: pathError } };
    }
  }

  const keyResult = await validateAndGetKey({
    keyString: key,
    pathHint: folderPathParam,
    requiredPermission: 'write',
  });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const folderPath = normalizeFolderPath(folderPathParam || '/');
  const folderPathNoSlash = folderPath.endsWith('/') && folderPath !== '/'
    ? folderPath.slice(0, -1)
    : folderPath === '/' ? '' : folderPath;

  if (folderPath !== '/') {
    const hasFiles = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        isNull(files.deletedAt),
        like(files.path, folderPath + '%')
      ),
      columns: { id: true },
    });
    const explicitFolder = await db.query.folders.findFirst({
      where: and(
        eq(folders.workspaceId, keyResult.key.workspaceId),
        eq(folders.path, folderPathNoSlash),
        isNull(folders.deletedAt)
      ),
    });
    if (!hasFiles && !explicitFolder) {
      return {
        status: 404,
        body: { ok: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } },
      };
    }
  }

  const folder = await db.query.folders.findFirst({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      eq(folders.path, folderPathNoSlash || '/'),
      isNull(folders.deletedAt)
    ),
  });

  return { status: 200, body: { ok: true, data: parseStoredSettings(folder?.settings) } };
}

type HandleUpdateFolderSettingsInput = {
  key: string;
  folderPathParam: string;
  body: FolderSettingsUpdateRequest;
  request: Request;
};

export async function handleUpdateFolderSettings({
  key, folderPathParam, body, request,
}: HandleUpdateFolderSettingsInput): Promise<HandlerResponse> {
  if (folderPathParam) {
    const pathError = validatePath(folderPathParam);
    if (pathError) {
      return { status: 400, body: { ok: false, error: pathError } };
    }
  }

  const keyResult = await validateAndGetKey({
    keyString: key,
    pathHint: folderPathParam,
    requiredPermission: 'write',
  });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const folderPath = normalizeFolderPath(folderPathParam || '/');
  const folderPathNoSlash = folderPath.endsWith('/') && folderPath !== '/'
    ? folderPath.slice(0, -1) : folderPath === '/' ? '/' : folderPath;

  const now = new Date().toISOString();
  let folder = await db.query.folders.findFirst({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      eq(folders.path, folderPathNoSlash),
      isNull(folders.deletedAt)
    ),
  });

  const existingSettings = parseStoredSettings(folder?.settings);
  const updatedSettings: FolderSettings = {
    inheritSettings: body.inheritSettings !== undefined ? body.inheritSettings : existingSettings.inheritSettings,
    defaultLabels: body.defaultLabels !== undefined ? body.defaultLabels : existingSettings.defaultLabels,
    allowedTypes: body.allowedTypes !== undefined ? body.allowedTypes : existingSettings.allowedTypes,
  };

  if (folder) {
    await db.update(folders)
      .set({ settings: updatedSettings as unknown as null, updatedAt: now })
      .where(eq(folders.id, folder.id));
  } else {
    await db.insert(folders).values({
      id: generateRecordId(),
      workspaceId: keyResult.key.workspaceId,
      path: folderPathNoSlash,
      settings: updatedSettings as unknown as null,
      createdAt: now,
      updatedAt: now,
    });
  }

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'folder.update_settings',
    resourceType: 'folder',
    resourcePath: folderPath,
    actorType: 'capability_url',
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    metadata: { settings: updatedSettings },
  });

  return { status: 200, body: { ok: true, data: updatedSettings } };
}


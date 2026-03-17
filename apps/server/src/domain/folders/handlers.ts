import { eq, and, isNull, like } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { capabilityKeys, files, folders, idempotencyKeys } from '../../db/schema';
import { hashKey, validateKey, generateKey } from '../../core/capability-keys';
import { validatePath, normalizeFolderPath } from '../../core/path-validation';
import { logAction } from '../../services/audit';
import type { CapabilityKeyRecord, KeyValidationResult, HandlerResponse, WorkspaceKeys, ElysiaContextSet, FolderListQuery, Permission } from '../../shared';
import {
  buildFileUrls,
  buildCursor,
  detectPossibleTraversal,
  generateFileId,
  generateRecordId,
  getWorkspaceContext,
  parsePaginationParams,
  validateFilename,
  validateFolderName,
  validateCapabilityKeyForCapabilityRoute,
} from '../../shared';
import type {
  FolderItem,
  PaginatedResponse,
  FolderListResponse,
  FolderDeleteResponse,
  FolderMoveResponse,
  Error as ApiError,
} from '@mdplane/shared';
import {
  zFolderListResponse,
  zFolderSearchResponse,
  zTaskQueryResponse,
  zFolderStatsResponse,
  zError,
  zListFolderContentsQuery,
  zListFolderContentsViaAppendKeyQuery,
  zListFolderContentsViaWriteKeyQuery,
  zListFolderClaimsQuery,
  zSearchInFolderQuery,
  zQueryFolderTasksQuery,
  type CreateFileRequest,
  type FolderCreateRequest,
  type FolderRenameRequest,
  type FolderDeleteRequest,
  type FolderSettings,
  type FolderSettingsUpdateRequest,
  type CopyFileToFolderRequest,
  type FolderBulkCreateRequest,
  type FolderMoveRequest,
  type ListFolderContentsQuery,
  type FolderClaimItem,
} from '@mdplane/shared';
import { serverEnv } from '../../config/env';

import {
  validateAndGetKey,
  normalizeMovePath,
  toFolderPathNoSlash,
  parseStoredSettings,
  getDefaultFolderSettings,
  validateCascadeConfirmPath,
  validateMovePaths,
} from './validation';
export {
  handleCreateFileInFolder,
  handleCopyFileToFolder,
  handleBulkCreateFiles,
} from './file-mutations';
export {
  handleGetFolderSettings,
  handleUpdateFolderSettings,
} from './settings';
export {
  handleCreateFolder,
  handleRenameFolder,
} from './folder-create-rename';
export {
  handleDeleteFolder,
  handleMoveFolder,
} from './folder-delete-move';
export {
  handleListFolderClaims,
  handleFolderExport,
  createTraversalHandler,
} from './folder-claims-export';
export type { FolderMutationsRouteDeps } from './types';

const BASE_URL = serverEnv.baseUrl;
const APP_URL = serverEnv.appUrl;

type HandleFolderRequestInput = {
  key: string;
  pathParam: string;
  rawUrl: string;
  set: ElysiaContextSet;
  query?: FolderListQuery;
  requiredPermission?: Permission;
};

export async function handleFolderRequest({
  key,
  pathParam,
  rawUrl,
  set,
  query,
  requiredPermission,
}: HandleFolderRequestInput): Promise<FolderListResponse | ApiError> {
  if (detectPossibleTraversal({ rawUrl, key, pathParam })) {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  }

  const pathError = validatePath(pathParam);
  if (pathError) {
    set.status = 400;
    return { ok: false, error: pathError };
  }

  const keyResult = await validateAndGetKey({ keyString: key, pathHint: pathParam, requiredPermission });
  if (!keyResult.ok) {
    set.status = keyResult.status;
    return { ok: false, error: keyResult.error };
  }

  const folderPath = normalizeFolderPath(pathParam);
  const folderPathNoSlash = folderPath.endsWith('/') && folderPath !== '/'
    ? folderPath.slice(0, -1)
    : folderPath === '/' ? '' : folderPath;

  const { limit, offset, sort, order } = parsePaginationParams(query);

  let directFilesQuery: string;
  let directFilesParams: (string | number)[];

  if (folderPath === '/') {
    directFilesQuery = `
      SELECT
        path,
        LENGTH(content) as size,
        updated_at as updatedAt
      FROM files
      WHERE workspace_id = ?
        AND deleted_at IS NULL
        AND path NOT LIKE '/%/%'
    `;
    directFilesParams = [keyResult.key.workspaceId];
  } else {
    directFilesQuery = `
      SELECT
        path,
        LENGTH(content) as size,
        updated_at as updatedAt
      FROM files
      WHERE workspace_id = ?
        AND deleted_at IS NULL
        AND path LIKE ? || '%'
        AND path NOT LIKE ? || '%/%'
    `;
    directFilesParams = [keyResult.key.workspaceId, folderPath, folderPath];
  }

  const directFilesResult = sqlite.query(directFilesQuery).all(...directFilesParams) as Array<{
    path: string;
    size: number;
    updatedAt: string;
  }>;

  let subfolderQuery: string;
  let subfolderParams: (string | number)[];

  if (folderPath === '/') {
    subfolderQuery = `
      SELECT
        SUBSTR(path, 2, CASE
          WHEN INSTR(SUBSTR(path, 2), '/') = 0 THEN LENGTH(path) - 1
          ELSE INSTR(SUBSTR(path, 2), '/') - 1
        END) as subfolderName,
        COUNT(*) as childCount,
        MAX(updated_at) as latestModified
      FROM files
      WHERE workspace_id = ?
        AND deleted_at IS NULL
        AND path LIKE '/%/%'
      GROUP BY subfolderName
    `;
    subfolderParams = [keyResult.key.workspaceId];
  } else {
    const prefixLen = folderPath.length;
    subfolderQuery = `
      SELECT
        SUBSTR(path, ? + 1, CASE
          WHEN INSTR(SUBSTR(path, ? + 1), '/') = 0 THEN LENGTH(path) - ?
          ELSE INSTR(SUBSTR(path, ? + 1), '/') - 1
        END) as subfolderName,
        COUNT(*) as childCount,
        MAX(updated_at) as latestModified
      FROM files
      WHERE workspace_id = ?
        AND deleted_at IS NULL
        AND path LIKE ? || '%/%'
      GROUP BY subfolderName
    `;
    subfolderParams = [prefixLen, prefixLen, prefixLen, prefixLen, keyResult.key.workspaceId, folderPath];
  }

  const subfolderStatsResult = sqlite.query(subfolderQuery).all(...subfolderParams) as Array<{
    subfolderName: string;
    childCount: number;
    latestModified: string;
  }>;

  const hasFiles = directFilesResult.length > 0 || subfolderStatsResult.length > 0;

  // explicitly created empty folders exist in the folders table
  const explicitFolder = folderPath !== '/' ? await db.query.folders.findFirst({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      eq(folders.path, folderPathNoSlash),
      isNull(folders.deletedAt)
    ),
  }) : null;

  const explicitSubfolders = await db.query.folders.findMany({
    where: and(
      eq(folders.workspaceId, keyResult.key.workspaceId),
      isNull(folders.deletedAt),
      folderPath === '/'
        ? undefined // Root: get all folders
        : like(folders.path, folderPathNoSlash + '/%')
    ),
    columns: {
      path: true,
      createdAt: true,
    },
  });

  if (folderPath !== '/' && !hasFiles && !explicitFolder && explicitSubfolders.length === 0) {
    set.status = 404;
    return { ok: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } };
  }

  const keys: WorkspaceKeys = {
    readKey: null,
    appendKey: null,
    writeKey: null,
  };

  const requestKeyPermission = keyResult.key.permission;

  if (requestKeyPermission === 'write') {
    keys.readKey = key;
    keys.appendKey = key;
    keys.writeKey = key;
  } else if (requestKeyPermission === 'append') {
    keys.readKey = key;
    keys.appendKey = key;
  } else {
    keys.readKey = key;
  }

  const folderItems: FolderItem[] = [];
  const existingFolderNames = new Set<string>();

  for (const subfolder of subfolderStatsResult) {
    if (subfolder.subfolderName) {
      folderItems.push({
        name: subfolder.subfolderName,
        type: 'folder',
        childCount: subfolder.childCount,
        updatedAt: subfolder.latestModified,
      });
      existingFolderNames.add(subfolder.subfolderName);
    }
  }

  for (const explicitSub of explicitSubfolders) {
    const relativePath = folderPath === '/'
      ? explicitSub.path.substring(1)
      : explicitSub.path.substring(folderPathNoSlash.length + 1);

    const slashIndex = relativePath.indexOf('/');
    const folderName = slashIndex === -1 ? relativePath : relativePath.substring(0, slashIndex);

    if (folderName && !existingFolderNames.has(folderName)) {
      const isDirectChild = slashIndex === -1;
      if (isDirectChild) {
        folderItems.push({
          name: folderName,
          type: 'folder',
          childCount: 0,
          updatedAt: explicitSub.createdAt,
        });
        existingFolderNames.add(folderName);
      }
    }
  }

  const fileItems: FolderItem[] = directFilesResult.map((file) => {
    const fileName = file.path.substring(folderPath.length);
    return {
      name: fileName,
      type: 'file' as const,
      size: file.size,
      updatedAt: file.updatedAt,
      urls: buildFileUrls({ baseUrl: BASE_URL, filePath: file.path, keys }),
    };
  });

  const sortItems = <T extends { name: string; size?: number; updatedAt?: string }>(items: T[]): T[] => {
    const sorted = [...items].sort((a, b) => {
      let comparison = 0;
      switch (sort) {
        case 'modified':
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          comparison = aTime - bTime;
          break;
        case 'size':
          comparison = (a.size ?? 0) - (b.size ?? 0);
          break;
        case 'name':
        default:
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          break;
      }
      return order === 'desc' ? -comparison : comparison;
    });
    return sorted;
  };

  const sortedFolders = sortItems(folderItems);
  const sortedFiles = sortItems(fileItems);
  const allItems = [...sortedFolders, ...sortedFiles];
  const totalCount = allItems.length;

  const paginatedItems = allItems.slice(offset, offset + limit);
  const hasMore = offset + limit < totalCount;
  const nextCursor = hasMore ? buildCursor(offset + limit) : undefined;

  const pagination: PaginatedResponse = {
    cursor: nextCursor,
    hasMore,
    total: totalCount,
  };

  const workspaceContext = await getWorkspaceContext(keyResult.key.workspaceId);

  set.status = 200;
  set.headers['Content-Type'] = 'application/json';

  const folderUrlPath = folderPath === '/' ? '' : folderPath.substring(1);
  const webUrl = `${APP_URL}/r/${key}/folders${folderUrlPath ? `/${folderUrlPath}` : ''}`;

  return {
    ok: true,
    data: {
      path: folderPath,
      items: paginatedItems,
      webUrl,
      ...(workspaceContext && { workspace: workspaceContext }),
    },
    pagination,
  };
}

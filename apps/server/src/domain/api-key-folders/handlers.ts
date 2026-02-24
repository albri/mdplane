import { eq, and, isNull, like } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { files, folders } from '../../db/schema';
import { generateKey, hashKey } from '../../core/capability-keys';
import type { FolderItem } from '@mdplane/shared';
import type { ListFolderInput, ListFolderResult, CreateFolderInput } from './types';
import { toFolderPathNoSlash } from './validation';

type SubfolderData = { childCount: number; updatedAt: string };

function buildFolderItems(
  subfolderData: Map<string, SubfolderData>,
  fileItems: FolderItem[]
): FolderItem[] {
  const folderItems: FolderItem[] = [];
  for (const [name, data] of subfolderData) {
    folderItems.push({ name, type: 'folder', childCount: data.childCount, updatedAt: data.updatedAt });
  }
  folderItems.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  fileItems.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return [...folderItems, ...fileItems];
}

function processFilesForListing(input: {
  allFiles: Array<{ id: string; path: string; content: string; updated_at: string }>;
  folderPath: string;
}): { fileItems: FolderItem[]; subfolderData: Map<string, SubfolderData> } {
  const { allFiles, folderPath } = input;
  const fileItems: FolderItem[] = [];
  const subfolderData = new Map<string, SubfolderData>();

  for (const file of allFiles) {
    const relativePath = file.path.substring(folderPath.length);
    if (!relativePath) continue;

    const slashIndex = relativePath.indexOf('/');
    if (slashIndex === -1) {
      fileItems.push({
        name: relativePath,
        type: 'file',
        size: Buffer.byteLength(file.content, 'utf-8'),
        updatedAt: file.updated_at,
      });
    } else {
      const subfolderName = relativePath.substring(0, slashIndex);
      const existing = subfolderData.get(subfolderName);
      if (existing) {
        existing.childCount++;
        if (file.updated_at > existing.updatedAt) existing.updatedAt = file.updated_at;
      } else {
        subfolderData.set(subfolderName, { childCount: 1, updatedAt: file.updated_at });
      }
    }
  }
  return { fileItems, subfolderData };
}

function addExplicitFoldersToListing(input: {
  explicitFolders: Array<{ path: string; created_at: string; updated_at: string | null }>;
  folderPath: string;
  subfolderData: Map<string, SubfolderData>;
}): void {
  const { explicitFolders, folderPath, subfolderData } = input;
  const folderPathNoSlash = toFolderPathNoSlash(folderPath);

  for (const folder of explicitFolders) {
    let rel: string;
    if (folderPath === '/') {
      rel = folder.path.startsWith('/') ? folder.path.substring(1) : folder.path;
    } else {
      rel = folder.path.startsWith(folderPathNoSlash + '/')
        ? folder.path.substring((folderPathNoSlash + '/').length)
        : folder.path;
    }
    if (!rel) continue;

    const slashIndex = rel.indexOf('/');
    const subfolderName = slashIndex === -1 ? rel : rel.substring(0, slashIndex);
    if (!subfolderName) continue;

    const folderUpdatedAt = folder.updated_at ?? folder.created_at;
    const existing = subfolderData.get(subfolderName);
    if (existing) {
      if (folderUpdatedAt > existing.updatedAt) existing.updatedAt = folderUpdatedAt;
    } else {
      subfolderData.set(subfolderName, { childCount: 0, updatedAt: folderUpdatedAt });
    }
  }
}

export async function listFolderContents(input: ListFolderInput): Promise<ListFolderResult> {
  const { workspaceId, folderPath, appUrl } = input;
  const folderPathNoSlash = toFolderPathNoSlash(folderPath);
  const folderPathWithSlash = folderPath === '/' ? '/' : (folderPathNoSlash + '/');

  const allFiles = sqlite.query(
    `SELECT id, path, content, updated_at FROM files
     WHERE workspace_id = ? AND deleted_at IS NULL ${folderPath === '/' ? '' : "AND path LIKE ? || '%'"}`
  ).all(folderPath === '/' ? workspaceId : workspaceId, ...(folderPath === '/' ? [] : [folderPathWithSlash])) as Array<{
    id: string; path: string; content: string; updated_at: string;
  }>;

  const relevantFiles = folderPath === '/' ? allFiles : allFiles.filter((f) => f.path.startsWith(folderPathWithSlash));

  let folderExists = folderPath === '/' || relevantFiles.length > 0;
  if (!folderExists && folderPath !== '/') {
    const explicitFolder = sqlite
      .query(`SELECT id FROM folders WHERE workspace_id = ? AND path = ? AND deleted_at IS NULL`)
      .get(workspaceId, folderPathNoSlash) as { id: string } | null;
    folderExists = explicitFolder !== null;
  }

  if (!folderExists) {
    return { ok: false, status: 404, error: { code: 'FOLDER_NOT_FOUND' } };
  }

  const { fileItems, subfolderData } = processFilesForListing({ allFiles: relevantFiles, folderPath: folderPathWithSlash });

  const queryPath = folderPathWithSlash;
  const explicitFolders = sqlite.query(
    `SELECT path, created_at, updated_at FROM folders WHERE workspace_id = ? AND deleted_at IS NULL${folderPath === '/' ? '' : " AND path LIKE ? || '%'"}`
  ).all(folderPath === '/' ? workspaceId : workspaceId, ...(folderPath === '/' ? [] : [queryPath])) as Array<{
    path: string; created_at: string; updated_at: string | null;
  }>;

  addExplicitFoldersToListing({ explicitFolders, folderPath: folderPathWithSlash, subfolderData });
  const items = buildFolderItems(subfolderData, fileItems);

  return { ok: true, data: { path: folderPathWithSlash, items, webUrl: `${appUrl}/control` } };
}

type CreateFolderWithUrlsInput = CreateFolderInput & { baseUrl: string; appUrl: string };
type CreateFolderWithUrlsResult =
  | { ok: true; data: { path: string; urls: { read: string; append: string; write: string }; createdAt: string; webUrl: string } }
  | { ok: false; status: number; error: { code: string; message: string } };

export async function createFolder(input: CreateFolderWithUrlsInput): Promise<CreateFolderWithUrlsResult> {
  const { workspaceId, parentPath, folderName, baseUrl, appUrl } = input;

  const normalizedParent = parentPath === '' ? '/' : toFolderPathNoSlash(parentPath);
  const fullPath = normalizedParent === '/' ? `/${folderName}` : `${normalizedParent}/${folderName}`;
  const folderPathWithSlash = fullPath + '/';
  const now = new Date().toISOString();

  const existingFolder = await db.query.folders.findFirst({
    where: and(eq(folders.workspaceId, workspaceId), eq(folders.path, fullPath), isNull(folders.deletedAt)),
  });
  if (existingFolder) {
    return { ok: false, status: 409, error: { code: 'FOLDER_ALREADY_EXISTS', message: `Folder '${fullPath}' already exists` } };
  }

  const filesInFolder = await db.query.files.findFirst({
    where: and(eq(files.workspaceId, workspaceId), isNull(files.deletedAt), like(files.path, folderPathWithSlash + '%')),
  });
  if (filesInFolder) {
    return { ok: false, status: 409, error: { code: 'FOLDER_ALREADY_EXISTS', message: `Folder '${fullPath}' already exists` } };
  }

  const folderId = generateKey(16);
  await db.insert(folders).values({ id: folderId, workspaceId, path: fullPath, createdAt: now });

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
    const keyId = generateKey(16);
    const keyHash = hashKey(keyData.key);
    insertKeyStmt.run(keyId, workspaceId, keyData.key.substring(0, 4), keyHash, keyData.permission, 'folder', fullPath, now);
  }

  const folderUrlPath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;

  return {
    ok: true,
    data: {
      path: fullPath,
      urls: {
        read: `${baseUrl}/r/${readKey}/folders/${folderUrlPath}`,
        append: `${baseUrl}/a/${appendKey}/folders/${folderUrlPath}`,
        write: `${baseUrl}/w/${writeKey}/folders/${folderUrlPath}`,
      },
      createdAt: now,
      webUrl: `${appUrl}/control`,
    },
  };
}

type DeleteFolderInput = {
  workspaceId: string;
  folderPath: string;
  cascade?: boolean;
  confirmPath?: string;
};

type DeleteFolderResult =
  | { ok: true; data: { path: string; deleted: boolean; filesDeleted?: number; foldersDeleted?: number; recoverable?: boolean; expiresAt?: string } }
  | { ok: false; status: number; error: { code: string; message: string; details?: { fileCount: number; folderCount: number } } };

export async function deleteFolder(input: DeleteFolderInput): Promise<DeleteFolderResult> {
  const { workspaceId, folderPath, cascade = false, confirmPath } = input;

  if (folderPath === '/') {
    return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'Cannot delete root folder' } };
  }

  const folderPathNoSlash = toFolderPathNoSlash(folderPath);
  const folderPathWithSlash = folderPathNoSlash + '/';

  const folderFiles = await db.query.files.findMany({
    where: and(eq(files.workspaceId, workspaceId), isNull(files.deletedAt), like(files.path, folderPathWithSlash + '%')),
    columns: { id: true, path: true },
  });

  const explicitFolder = await db.query.folders.findFirst({
    where: and(eq(folders.workspaceId, workspaceId), eq(folders.path, folderPathNoSlash), isNull(folders.deletedAt)),
  });

  const childFolders = await db.query.folders.findMany({
    where: and(eq(folders.workspaceId, workspaceId), isNull(folders.deletedAt), like(folders.path, folderPathNoSlash + '/%')),
    columns: { id: true, path: true },
  });

  if (folderFiles.length === 0 && !explicitFolder) {
    return { ok: false, status: 404, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } };
  }

  const subfolders = new Set<string>();
  for (const file of folderFiles) {
    const relativePath = file.path.substring(folderPathWithSlash.length);
    const slashIndex = relativePath.indexOf('/');
    if (slashIndex !== -1) subfolders.add(relativePath.substring(0, slashIndex));
  }
  for (const childFolder of childFolders) {
    const relativePath = childFolder.path.substring(folderPathNoSlash.length + 1);
    const slashIndex = relativePath.indexOf('/');
    const subfolderName = slashIndex === -1 ? relativePath : relativePath.substring(0, slashIndex);
    if (subfolderName) subfolders.add(subfolderName);
  }

  const folderCount = subfolders.size;
  const fileCount = folderFiles.length;

  if (fileCount > 0 && !cascade) {
    return {
      ok: false, status: 409,
      error: { code: 'FOLDER_NOT_EMPTY', message: `Folder contains ${fileCount} files and ${folderCount} subfolders`, details: { fileCount, folderCount } },
    };
  }

  const now = new Date().toISOString();
  const pathForResponse = folderPathNoSlash;

  if (cascade && fileCount > 0) {
    const expectedConfirmPath = pathForResponse.startsWith('/') ? pathForResponse.substring(1) : pathForResponse;
    if (confirmPath !== expectedConfirmPath) {
      return { ok: false, status: 400, error: { code: 'CONFIRM_PATH_MISMATCH', message: `confirmPath '${confirmPath || ''}' does not match folder path '${expectedConfirmPath}'` } };
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

    return { ok: true, data: { path: pathForResponse, deleted: true, filesDeleted: fileCount, foldersDeleted: folderCount, recoverable: true, expiresAt } };
  }

  if (explicitFolder) {
    await db.update(folders).set({ deletedAt: now }).where(eq(folders.id, explicitFolder.id));
  }
  for (const childFolder of childFolders) {
    await db.update(folders).set({ deletedAt: now }).where(eq(folders.id, childFolder.id));
  }

  return { ok: true, data: { path: pathForResponse, deleted: true } };
}

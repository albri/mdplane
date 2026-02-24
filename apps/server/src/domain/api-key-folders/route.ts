import { Elysia } from 'elysia';
import { hasRequiredScope, insufficientScopeResponse, updateApiKeyLastUsed } from '../../shared';
import type { AuthenticateApiKeyRequestResult } from '../api-keys/types';
import {
  zApiCreateFolderByPathData,
  zApiListFolderByPathQuery,
  zApiListRootFolderQuery,
  zFolderDeleteRequest,
} from '@mdplane/shared';
import {
  listFolderContents,
  createFolder,
  deleteFolder,
} from './handlers';
import {
  decodeAndValidatePath,
  toFolderPathNoSlash,
  validateFolderName,
} from './validation';

type ApiKeyFoldersRouteDeps = {
  appUrl: string;
  baseUrl: string;
  authenticateApiKeyRequest: (request: Request) => Promise<AuthenticateApiKeyRequestResult>;
};

export function createApiKeyFoldersRoute({
  appUrl,
  baseUrl,
  authenticateApiKeyRequest,
}: ApiKeyFoldersRouteDeps) {
  return new Elysia()
  .get('/api/v1/folders', async ({ query, set, request }) => {
    void query.recursive; void query.depth; void query.limit; void query.cursor;
    const keyResult = await authenticateApiKeyRequest(request);
    if (!keyResult.ok) { set.status = keyResult.status; return keyResult.body; }
    if (!hasRequiredScope(keyResult.key.scopes, 'read')) { set.status = 403; return insufficientScopeResponse(); }
    updateApiKeyLastUsed(keyResult.key.id);

    const result = await listFolderContents({ workspaceId: keyResult.key.workspaceId, folderPath: '/', appUrl });
    if (!result.ok) { set.status = result.status; return { ok: false, error: result.error }; }
    set.status = 200;
    return { ok: true, data: result.data, pagination: { cursor: null, hasMore: false, total: result.data.items.length } };
  }, { query: zApiListRootFolderQuery })

  .get('/api/v1/folders/*', async ({ params, query, set, request }) => {
    void query.recursive; void query.depth; void query.limit; void query.cursor;
    const keyResult = await authenticateApiKeyRequest(request);
    if (!keyResult.ok) { set.status = keyResult.status; return keyResult.body; }
    if (!hasRequiredScope(keyResult.key.scopes, 'read')) { set.status = 403; return insufficientScopeResponse(); }
    updateApiKeyLastUsed(keyResult.key.id);

    const rawPathParam = (params as Record<string, string>)['*'] || '';
    const pathValidation = decodeAndValidatePath(rawPathParam);
    if (!pathValidation.ok) { set.status = 400; return { ok: false, error: pathValidation.error }; }
    const folderPath = toFolderPathNoSlash(pathValidation.path);

    const result = await listFolderContents({ workspaceId: keyResult.key.workspaceId, folderPath, appUrl });
    if (!result.ok) { set.status = result.status; return { ok: false, error: result.error }; }
    set.status = 200;
    return { ok: true, data: result.data, pagination: { cursor: null, hasMore: false, total: result.data.items.length } };
  }, { query: zApiListFolderByPathQuery })

  .post('/api/v1/folders/*', async ({ params, body, set, request }) => {
    const keyResult = await authenticateApiKeyRequest(request);
    if (!keyResult.ok) { set.status = keyResult.status; return keyResult.body; }
    if (!hasRequiredScope(keyResult.key.scopes, 'write')) { set.status = 403; return insufficientScopeResponse(); }
    updateApiKeyLastUsed(keyResult.key.id);

    const parentPathParam = (params as Record<string, string>)['*'] || '';
    const pathValidation = decodeAndValidatePath(parentPathParam);
    if (!pathValidation.ok) { set.status = 400; return { ok: false, error: pathValidation.error }; }

    const requestBody = body as { name?: string } | null;
    const nameValidation = validateFolderName(requestBody?.name);
    if (!nameValidation.ok) { set.status = 400; return { ok: false, error: nameValidation.error }; }

    const result = await createFolder({
      workspaceId: keyResult.key.workspaceId,
      parentPath: pathValidation.path,
      folderName: nameValidation.path,
      baseUrl,
      appUrl,
    });
    if (!result.ok) { set.status = result.status; return { ok: false, error: result.error }; }
    set.status = 201;
    return { ok: true, data: result.data };
  }, { body: zApiCreateFolderByPathData.shape.body })

  .post('/api/v1/folders', async ({ body, set, request }) => {
    const keyResult = await authenticateApiKeyRequest(request);
    if (!keyResult.ok) { set.status = keyResult.status; return keyResult.body; }
    if (!hasRequiredScope(keyResult.key.scopes, 'write')) { set.status = 403; return insufficientScopeResponse(); }
    updateApiKeyLastUsed(keyResult.key.id);

    const requestBody = body as { name?: string } | null;
    const nameValidation = validateFolderName(requestBody?.name);
    if (!nameValidation.ok) { set.status = 400; return { ok: false, error: nameValidation.error }; }

    const result = await createFolder({
      workspaceId: keyResult.key.workspaceId,
      parentPath: '',
      folderName: nameValidation.path,
      baseUrl,
      appUrl,
    });
    if (!result.ok) { set.status = result.status; return { ok: false, error: result.error }; }
    set.status = 201;
    return { ok: true, data: result.data };
  }, { body: zApiCreateFolderByPathData.shape.body })

  .delete('/api/v1/folders/*', async ({ params, body, set, request }) => {
    const keyResult = await authenticateApiKeyRequest(request);
    if (!keyResult.ok) { set.status = keyResult.status; return keyResult.body; }
    if (!hasRequiredScope(keyResult.key.scopes, 'write')) { set.status = 403; return insufficientScopeResponse(); }
    updateApiKeyLastUsed(keyResult.key.id);

    const folderPathParam = (params as Record<string, string>)['*'] || '';
    const pathValidation = decodeAndValidatePath(folderPathParam);
    if (!pathValidation.ok) { set.status = 400; return { ok: false, error: pathValidation.error }; }
    const folderPath = '/' + pathValidation.path;

    if (folderPath === '/') { set.status = 400; return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Cannot delete root folder' } }; }

    const deleteBody = body as { cascade?: boolean; confirmPath?: string } | null;
    const result = await deleteFolder({
      workspaceId: keyResult.key.workspaceId,
      folderPath,
      cascade: deleteBody?.cascade ?? false,
      confirmPath: deleteBody?.confirmPath,
    });
    if (!result.ok) { set.status = result.status; return { ok: false, error: result.error }; }
    set.status = 200;
    return { ok: true, data: result.data };
  }, { body: zFolderDeleteRequest.optional() });
}

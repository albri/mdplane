import { Elysia } from 'elysia';
import { hasRequiredScope, insufficientScopeResponse, updateApiKeyLastUsed, applyHandlerResponse } from '../../shared';
import { zApiDeleteFileByPathQuery } from '@mdplane/shared';
import type { AuthenticateApiKeyRequestResult } from '../api-keys/types';
import {
  handleGetFile,
  handleAppendToFile,
  handleCreateOrWriteFile,
  handleUpdateFile,
  handleDeleteFile,
} from './handlers';

type ApiKeyFilesRouteDeps = {
  appUrl: string;
  baseUrl: string;
  authenticateApiKeyRequest: (request: Request) => Promise<AuthenticateApiKeyRequestResult>;
};

function getWildcardParam(params: unknown): string {
  if (!params || typeof params !== 'object') {
    return '';
  }
  const wildcard = (params as Record<string, unknown>)['*'];
  return typeof wildcard === 'string' ? wildcard : '';
}

function decodePathParam(params: unknown): { ok: true; path: string } | { ok: false; error: { code: string; message: string } } {
  try {
    const decoded = decodeURIComponent(getWildcardParam(params));
    return { ok: true, path: '/' + decoded };
  } catch {
    return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid URL encoding' } };
  }
}

export function createApiKeyFilesRoute({
  appUrl,
  baseUrl,
  authenticateApiKeyRequest,
}: ApiKeyFilesRouteDeps) {
  return new Elysia()
  .get('/api/v1/files/*', async ({ params, set, request }) => {
    const keyResult = await authenticateApiKeyRequest(request);
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return keyResult.body;
    }
    if (!hasRequiredScope(keyResult.key.scopes, 'read')) {
      set.status = 403;
      return insufficientScopeResponse();
    }
    updateApiKeyLastUsed(keyResult.key.id);

    const pathResult = decodePathParam(params);
    if (!pathResult.ok) {
      set.status = 400;
      return { ok: false, error: pathResult.error };
    }

    const result = handleGetFile({ key: keyResult.key, path: pathResult.path });
    return applyHandlerResponse(result, set);
  })

  // POST /api/v1/files/*path - Create/write/append file with API key
  // If decoded path ends with '/append', treats as append operation; otherwise write/create
  .post('/api/v1/files/*', async ({ params, body, set, request }) => {
    const keyResult = await authenticateApiKeyRequest(request);
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return keyResult.body;
    }
    updateApiKeyLastUsed(keyResult.key.id);

    const pathResult = decodePathParam(params);
    if (!pathResult.ok) {
      set.status = 400;
      return { ok: false, error: pathResult.error };
    }

    // Check if this is an append request (path ends with '/append')
    const decodedPath = pathResult.path.substring(1); // Remove leading '/'
    const isAppend = decodedPath.endsWith('/append');

    if (isAppend) {
      if (!hasRequiredScope(keyResult.key.scopes, 'append')) {
        set.status = 403;
        return insufficientScopeResponse();
      }
      const filePath = '/' + decodedPath.slice(0, -'/append'.length);
      const result = handleAppendToFile({ key: keyResult.key, path: filePath, body });
      return applyHandlerResponse(result, set);
    } else {
      if (!hasRequiredScope(keyResult.key.scopes, 'write')) {
        set.status = 403;
        return insufficientScopeResponse();
      }
      const result = handleCreateOrWriteFile({ key: keyResult.key, path: pathResult.path, body, baseUrl, appUrl });
      return applyHandlerResponse(result, set);
    }
  })



  // PUT /api/v1/files/*path - Update file with API key
  .put('/api/v1/files/*', async ({ params, body, set, request }) => {
    const keyResult = await authenticateApiKeyRequest(request);
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return keyResult.body;
    }
    if (!hasRequiredScope(keyResult.key.scopes, 'write')) {
      set.status = 403;
      return insufficientScopeResponse();
    }
    updateApiKeyLastUsed(keyResult.key.id);

    const pathResult = decodePathParam(params);
    if (!pathResult.ok) {
      set.status = 400;
      return { ok: false, error: pathResult.error };
    }

    const result = handleUpdateFile({
      key: keyResult.key,
      path: pathResult.path,
      body,
      ifMatchHeader: request.headers.get('If-Match'),
      appUrl,
    });
    return applyHandlerResponse(result, set);
  })

  // DELETE /api/v1/files/*path - Delete file with API key
  .delete('/api/v1/files/*', async ({ params, query, set, request }) => {
    const keyResult = await authenticateApiKeyRequest(request);
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return keyResult.body;
    }
    if (!hasRequiredScope(keyResult.key.scopes, 'write')) {
      set.status = 403;
      return insufficientScopeResponse();
    }
    updateApiKeyLastUsed(keyResult.key.id);

    const pathResult = decodePathParam(params);
    if (!pathResult.ok) {
      set.status = 400;
      return { ok: false, error: pathResult.error };
    }

    const result = handleDeleteFile({ key: keyResult.key, path: pathResult.path, permanent: query.permanent === 'true' });
    return applyHandlerResponse(result, set);
  }, {
    query: zApiDeleteFileByPathQuery,
  });
}

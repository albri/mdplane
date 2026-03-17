import { Elysia } from 'elysia';
import {
  zApiKeyCreateRequest,
  zApiKeyCreateResponse,
  zApiKeyListResponse,
  zRevokeApiKeyResponse,
  zError,
} from '@mdplane/shared';
import {
  type ApiKeyManagementHandlerDeps,
  handleCreateApiKey,
  handleListApiKeys,
  handleRevokeApiKey,
} from './handlers';

export function createApiKeyManagementRoute(deps: ApiKeyManagementHandlerDeps) {
  return new Elysia()
    .post('/workspaces/:workspaceId/api-keys', async ({ params, body, set, request }) => {
      const result = await handleCreateApiKey({
        workspaceId: params.workspaceId,
        body,
        request,
        deps,
      });
      set.status = result.status;
      if (result.status === 201) {
        return zApiKeyCreateResponse.parse(result.body);
      }
      return zError.parse(result.body);
    }, {
      body: zApiKeyCreateRequest,
      response: {
        201: zApiKeyCreateResponse,
        400: zError,
        401: zError,
        403: zError,
        404: zError,
        429: zError,
      },
    })
    .get('/workspaces/:workspaceId/api-keys', async ({ params, set, request }) => {
      const result = await handleListApiKeys({
        workspaceId: params.workspaceId,
        request,
        deps,
      });
      set.status = result.status;
      if (result.status === 200) {
        return zApiKeyListResponse.parse(result.body);
      }
      return zError.parse(result.body);
    }, {
      response: {
        200: zApiKeyListResponse,
        401: zError,
        403: zError,
        404: zError,
        500: zError,
      },
    })
    .delete('/workspaces/:workspaceId/api-keys/:keyId', async ({ params, set, request }) => {
      const result = await handleRevokeApiKey({
        workspaceId: params.workspaceId,
        keyId: params.keyId,
        request,
        deps,
      });
      set.status = result.status;
      if (result.status === 200) {
        return zRevokeApiKeyResponse.parse(result.body);
      }
      return zError.parse(result.body);
    }, {
      response: {
        200: zRevokeApiKeyResponse,
        401: zError,
        403: zError,
        404: zError,
      },
    });
}

import { Elysia } from 'elysia';
import {
  zDeleteWorkspaceResponse,
  zError,
  zRotateAllUrlsResponse,
  zWorkspaceRenameRequest,
  zWorkspaceRenameResponse,
} from '@mdplane/shared';
import {
  handleDeleteWorkspace,
  handleRenameWorkspace,
  handleRenameWorkspaceViaWriteKey,
  handleRotateAllWorkspaceKeys,
} from './handlers';

export const workspacesRoute = new Elysia()
  .patch('/w/:key/workspace', async ({ params, body, set }) => {
    const result = await handleRenameWorkspaceViaWriteKey(params.key, body.name);
    set.status = result.status;
    if (result.status === 200) {
      return zWorkspaceRenameResponse.parse(result.body);
    }
    return zError.parse(result.body);
  }, {
    body: zWorkspaceRenameRequest,
    response: {
      200: zWorkspaceRenameResponse,
      400: zError,
      403: zError,
      404: zError,
    },
  })
  .delete('/workspaces/:workspaceId', async ({ params, set, request }) => {
    const result = await handleDeleteWorkspace(request, params.workspaceId);
    set.status = result.status;
    if (result.status === 200) {
      return zDeleteWorkspaceResponse.parse(result.body);
    }
    return zError.parse(result.body);
  }, {
    response: {
      200: zDeleteWorkspaceResponse,
      401: zError,
      403: zError,
      404: zError,
    },
  })
  .patch('/workspaces/:workspaceId/name', async ({ params, body, set, request }) => {
    const result = await handleRenameWorkspace(request, params.workspaceId, body.name);
    set.status = result.status;
    if (result.status === 200) {
      return zWorkspaceRenameResponse.parse(result.body);
    }
    return zError.parse(result.body);
  }, {
    body: zWorkspaceRenameRequest,
    response: {
      200: zWorkspaceRenameResponse,
      400: zError,
      401: zError,
      403: zError,
      404: zError,
    },
  })
  .post('/workspaces/:workspaceId/rotate-all', async ({ params, set, request }) => {
    const result = await handleRotateAllWorkspaceKeys(request, params.workspaceId);
    set.status = result.status;
    if (result.status === 200) {
      return zRotateAllUrlsResponse.parse(result.body);
    }
    return zError.parse(result.body);
  }, {
    response: {
      200: zRotateAllUrlsResponse,
      401: zError,
      403: zError,
      404: zError,
    },
  });

import { Elysia } from 'elysia';
import { zClaimWorkspaceResponse, zError } from '@mdplane/shared';
import { handleClaimWorkspace, resetClaimState } from './handlers';

export { resetClaimState };

export const claimRoute = new Elysia()
  .onError(({ error, set, code }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
        },
      };
    }
    throw error;
  })
  .post('/w/:key/claim', async ({ params, request, set }) => {
    const result = await handleClaimWorkspace(params.key, request);
    set.status = result.status;
    if (result.status === 200) {
      return zClaimWorkspaceResponse.parse(result.body);
    }
    return zError.parse(result.body);
  }, {
    response: {
      200: zClaimWorkspaceResponse,
      400: zError,
      401: zError,
      404: zError,
      429: zError,
    },
  });

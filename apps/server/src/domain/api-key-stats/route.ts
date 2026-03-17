import { Elysia } from 'elysia';
import { handleGetApiKeyStats } from './handlers';
import type { AuthenticateApiKeyRequestResult } from '../api-keys/types';

type ApiKeyStatsRouteDeps = {
  authenticateApiKeyRequest: (request: Request) => Promise<AuthenticateApiKeyRequestResult>;
};

export function createApiKeyStatsRoute({ authenticateApiKeyRequest }: ApiKeyStatsRouteDeps) {
  return new Elysia().get('/api/v1/stats', async ({ set, request }) => {
    const result = await handleGetApiKeyStats({
      request,
      authenticateApiKeyRequest,
    });

    set.status = result.status;
    return result.body;
  });
}

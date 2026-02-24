import { Elysia } from 'elysia';
import { createApiKeyFilesRoute } from '../api-key-files/route';
import { createApiKeyFoldersRoute } from '../api-key-folders/route';
import { createApiKeyManagementRoute } from '../api-key-management/route';
import { createApiKeyStatsRoute } from '../api-key-stats/route';
import { serverEnv } from '../../config/env';
import {
  authenticateApiKeyRequest,
  getApiKeyRateLimiter,
  resetApiKeyRateLimits,
  validateSessionAndOwnership,
} from './handlers';

const BASE_URL = serverEnv.baseUrl;
const APP_URL = serverEnv.appUrl;

export function resetRateLimits(): void {
  resetApiKeyRateLimits();
}

export const apiKeysRoute = new Elysia()
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

  .use(createApiKeyManagementRoute({
    appUrl: APP_URL,
    maxNameLength: 64,
    validateSessionAndOwnership,
    rateLimiter: getApiKeyRateLimiter(),
  }))

  .use(createApiKeyFilesRoute({
    appUrl: APP_URL,
    baseUrl: BASE_URL,
    authenticateApiKeyRequest,
  }))

  .use(createApiKeyFoldersRoute({
    appUrl: APP_URL,
    baseUrl: BASE_URL,
    authenticateApiKeyRequest,
  }))

  .use(createApiKeyStatsRoute({ authenticateApiKeyRequest }));

import { Elysia } from 'elysia';
import { z } from 'zod';
import { db } from '../../db';
import {
  zAppendRequest,
  zMultiAppendRequest,
  zAppendResponse,
  zError,
} from '@mdplane/shared';
import type { Permission, KeyValidationResult, CapabilityKeyRecord } from '../../shared';
import { validateCapabilityKeyForCapabilityRoute } from '../../shared';
import { createAppendPathRoutes } from './path-routes';
import { handleAppendRequest } from './single';
import {
  type AppendRequestBody,
  type HandleAppendRequestInput,
} from './types';

const zAppendRequestBody = z.union([zAppendRequest, zMultiAppendRequest]);

function normalizePathForComparison(path: string): string | null {
  let normalized = path.trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    return null;
  }
  normalized = normalized.replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}

async function validateAndGetKey(
  keyString: string,
  requiredPermission?: Permission
): Promise<KeyValidationResult> {
  return validateCapabilityKeyForCapabilityRoute({
    keyString,
    lookupByHash: async (keyHash) => {
      const keyRecord = await db.query.capabilityKeys.findFirst({
        where: (fields, { eq }) => eq(fields.keyHash, keyHash),
      });
      return keyRecord as CapabilityKeyRecord | null;
    },
    requiredPermission,
  });
}

export const appendsRoute = new Elysia()
  .onError(({ error, set, code }) => {
    if (code === 'PARSE' || (error instanceof Error && error.message?.includes('JSON'))) {
      set.status = 400;
      return {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid JSON in request body',
        },
      };
    }
    if (code === 'VALIDATION') {
      set.status = 400;
      const errorStr = JSON.stringify(error);

      if (errorStr.includes('invalid_string') && errorStr.includes('author')) {
        return {
          ok: false,
          error: {
            code: 'INVALID_AUTHOR',
            message: 'Invalid author format',
          },
        };
      }

      if (errorStr.includes('"path":"/value"')) {
        return {
          ok: false,
          error: {
            code: 'INVALID_VOTE_VALUE',
            message: 'Vote value must be +1 or -1',
          },
        };
      }

      if (errorStr.includes('"path":"/type"') ||
          (errorStr.includes('"type"') && errorStr.includes('invalid_literal'))) {
        return {
          ok: false,
          error: {
            code: 'INVALID_APPEND_TYPE',
            message: 'Invalid append type',
          },
        };
      }

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
  .post('/a/:key/append', async ({ params, body, set, request }) => {
    const key = params.key;
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const requestBody = body as AppendRequestBody;

    const keyResult = await validateAndGetKey(key, 'append');

    if (!keyResult.ok) {
      set.status = keyResult.status;
      set.headers['Content-Type'] = 'application/json';
      return { ok: false, error: keyResult.error };
    }

    const capKey = keyResult.key;
    const requestPath = typeof requestBody.path === 'string' && requestBody.path.trim() !== ''
      ? requestBody.path
      : null;

    if (
      (capKey.scopeType === 'file' || capKey.scopeType === 'folder') &&
      (typeof capKey.scopePath !== 'string' || capKey.scopePath.trim() === '')
    ) {
      set.status = 404;
      set.headers['Content-Type'] = 'application/json';
      return {
        ok: false,
        error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' },
      };
    }

    let targetPath: string;
    if (capKey.scopeType === 'file' && capKey.scopePath) {
      const normalizedScopePath = normalizePathForComparison(capKey.scopePath);
      if (!normalizedScopePath) {
        set.status = 404;
        set.headers['Content-Type'] = 'application/json';
        return {
          ok: false,
          error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' },
        };
      }

      if (requestPath) {
        const normalizedRequestPath = normalizePathForComparison(requestPath);
        if (!normalizedRequestPath) {
          set.status = 400;
          set.headers['Content-Type'] = 'application/json';
          return {
            ok: false,
            error: { code: 'INVALID_PATH', message: 'Invalid path encoding' },
          };
        }

        if (normalizedRequestPath !== normalizedScopePath) {
          set.status = 404;
          set.headers['Content-Type'] = 'application/json';
          return {
            ok: false,
            error: { code: 'PERMISSION_DENIED', message: 'Path outside of key scope' },
          };
        }
      }
      targetPath = requestPath ?? capKey.scopePath;
    } else {
      if (!requestPath) {
        set.status = 400;
        set.headers['Content-Type'] = 'application/json';
        return {
          ok: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'path is required for workspace-scoped and folder-scoped capability keys',
          },
        };
      }
      targetPath = requestPath;
    }

    const result = await handleAppendRequest({
      key,
      path: targetPath,
      body: requestBody,
      idempotencyKey,
      keyResult,
    });

    set.status = result.status;
    set.headers['Content-Type'] = 'application/json';
    if (result.headers) {
      Object.assign(set.headers, result.headers);
    }
    return result.body;
  }, {
    body: zAppendRequestBody,
    response: {
      201: zAppendResponse,
      400: zError,
      404: zError,
      409: zError,
      410: zError,
      413: zError,
      429: zError,
    },
  })
  .use(createAppendPathRoutes({
    validateAndGetKey,
    handleAppendRequest: (input) => handleAppendRequest(input as HandleAppendRequestInput),
  }));

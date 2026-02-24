import { Elysia } from 'elysia';
import { db } from '../../db';
import {
  zScopedKeyCreateRequest,
  zCapabilitiesCheckRequest,
  zCapabilitiesCheckResponse,
  zCapabilitiesCheckInWorkspaceResponse,
  zScopedKeyCreateResponse,
  zScopedKeyListResponse,
  zListScopedKeysQuery,
  zKeyRevokeResponse,
  zError,
} from '@mdplane/shared';
import type { Permission, KeyValidationResult, ExtendedCapabilityKeyRecord } from '../../shared';
import { validateCapabilityKeyForCapabilityRoute } from '../../shared';
import { serverEnv } from '../../config/env';
import {
  checkCapabilities,
  checkCapabilitiesInWorkspace,
  createScopedKey,
  listKeys,
  revokeKey,
} from './handlers';

const APP_URL = serverEnv.appUrl;
type CapabilityKeyRecord = ExtendedCapabilityKeyRecord;

type ValidateAndGetKeyInput = { keyString: string; requiredPermission?: Permission };

async function validateAndGetKey({ keyString, requiredPermission }: ValidateAndGetKeyInput): Promise<KeyValidationResult> {
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

export const keysRoute = new Elysia()
  .onError(({ error, set, code }) => {
    if (code === 'PARSE' || (error instanceof Error && error.message?.includes('JSON'))) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON in request body' } };
    }
    if (code === 'VALIDATION') {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Request validation failed' } };
    }
    throw error;
  })

  .post('/capabilities/check', async ({ body, set }) => {
    const results = await checkCapabilities(body.keys);
    set.status = 200;
    return { ok: true, data: { results } };
  }, {
    body: zCapabilitiesCheckRequest,
    response: { 200: zCapabilitiesCheckResponse, 400: zError },
  })

  .post('/w/:key/capabilities/check', async ({ params, body, set }) => {
    const keyResult = await validateAndGetKey({ keyString: params.key, requiredPermission: 'read' });
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return { ok: false, error: keyResult.error };
    }
    const results = await checkCapabilitiesInWorkspace({ keys: body.keys, workspaceId: keyResult.key.workspaceId });
    set.status = 200;
    return { ok: true, data: { results } };
  }, {
    body: zCapabilitiesCheckRequest,
    response: { 200: zCapabilitiesCheckInWorkspaceResponse, 400: zError, 404: zError },
  })

  .post('/w/:key/keys', async ({ params, body, set }) => {
    const keyResult = await validateAndGetKey({ keyString: params.key, requiredPermission: 'write' });
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return { ok: false, error: keyResult.error };
    }
    const result = await createScopedKey({
      workspaceId: keyResult.key.workspaceId,
      parentPermission: keyResult.key.permission,
      requestedPermission: body.permission,
      paths: body.paths,
      boundAuthor: body.boundAuthor,
      allowedTypes: body.allowedTypes,
      wipLimit: body.wipLimit,
      displayName: body.displayName,
      expiresAt: body.expiresAt,
    });
    if (!result.ok) {
      set.status = result.status;
      return { ok: false, error: result.error };
    }
    set.status = 201;
    return { ok: true, data: result.data, webUrl: `${APP_URL}/control/${keyResult.key.workspaceId}/api-keys` };
  }, {
    body: zScopedKeyCreateRequest,
    response: { 201: zScopedKeyCreateResponse, 400: zError, 404: zError },
  })

  .get('/w/:key/keys', async ({ params, query, set }) => {
    const keyResult = await validateAndGetKey({ keyString: params.key, requiredPermission: 'write' });
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return { ok: false, error: keyResult.error };
    }
    const result = await listKeys({ workspaceId: keyResult.key.workspaceId, includeRevoked: query.includeRevoked === 'true' });
    set.status = 200;
    return { ok: true, data: result.data, webUrl: `${APP_URL}/control/${keyResult.key.workspaceId}/api-keys` };
  }, {
    query: zListScopedKeysQuery,
    response: { 200: zScopedKeyListResponse, 400: zError, 404: zError },
  })

  .delete('/w/:key/keys/:keyId', async ({ params, set }) => {
    const keyResult = await validateAndGetKey({ keyString: params.key, requiredPermission: 'write' });
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return { ok: false, error: keyResult.error };
    }
    const result = await revokeKey({ workspaceId: keyResult.key.workspaceId, keyId: params.keyId });
    if (!result.ok) {
      set.status = result.status;
      return { ok: false, error: result.error };
    }
    set.status = 200;
    return { ok: true, data: result.data };
  }, {
    response: { 200: zKeyRevokeResponse, 404: zError },
  });

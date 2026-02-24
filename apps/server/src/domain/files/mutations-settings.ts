import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { files, idempotencyKeys } from '../../db/schema';
import {
  zError,
  zFileSettingsUpdateRequest,
  zGetFileSettingsResponse,
  zGetStatsViaWriteKeyResponse,
  zUpdateFileSettingsResponse,
} from '@mdplane/shared';
import type { FileSettings } from '@mdplane/shared';
import {
  applyIdempotencyReplay,
  findFileForScope,
  getIdempotencyKey,
  getRequestAuditContext,
  getScopedFileStats,
  hasRawPathTraversal,
  pathTraversalErrorResponse,
  validateAndGetFileKey as validateAndGetKey,
} from '../../shared';
import { logAction } from '../../services/audit';

export const filesMutationsSettingsRoute = new Elysia()  .get('/w/:key/settings', async ({ params, set, request }) => {
    const key = params.key;

    const rawUrl = request.url;
    if (hasRawPathTraversal(rawUrl)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    const keyResult = await validateAndGetKey({ keyString: key, requiredPermission: 'write' });
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return { ok: false, error: keyResult.error };
    }

    const capKey = keyResult.key;

    const file = await findFileForScope({ workspaceId: keyResult.key.workspaceId, capKey });

    if (!file) {
      set.status = 404;
      return { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
    }

    const settings: FileSettings = file.settings ? (file.settings as FileSettings) : {};

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    return {
      ok: true,
      data: settings,
    };
  }, {
    response: {
      200: zGetFileSettingsResponse,
      400: zError,
      404: zError,
    },
  })
  .patch('/w/:key/settings', async ({ params, body, set, request }) => {
    const key = params.key;

    const rawUrl = request.url;
    if (hasRawPathTraversal(rawUrl)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    const keyResult = await validateAndGetKey({ keyString: key, requiredPermission: 'write' });
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return { ok: false, error: keyResult.error };
    }

    const idempotencyKey = getIdempotencyKey(request);

    if (idempotencyKey) {
      const existing = await db.query.idempotencyKeys.findFirst({
        where: eq(idempotencyKeys.key, idempotencyKey),
      });

      if (existing && applyIdempotencyReplay(existing, set)) return JSON.parse(existing.responseBody);
    }

    const settingsUpdate = body;

    const capKey = keyResult.key;

    const file = await findFileForScope({ workspaceId: keyResult.key.workspaceId, capKey });

    if (!file) {
      set.status = 404;
      return { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
    }

    const currentSettings: FileSettings = file.settings ? (file.settings as FileSettings) : {};
    const updatedSettings: FileSettings = { ...currentSettings, ...settingsUpdate };
    const now = new Date().toISOString();
    await db.update(files)
      .set({
        settings: updatedSettings,
        updatedAt: now,
      })
      .where(eq(files.id, file.id));

    logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'file.settings_update',
      resourceType: 'file',
      resourceId: file.id,
      resourcePath: file.path,
      actorType: 'capability_url',
      metadata: { settings: updatedSettings },
      ...getRequestAuditContext(request),
    });

    const responseBody = {
      ok: true,
      data: updatedSettings,
    };

    if (idempotencyKey) {
      await db.insert(idempotencyKeys).values({
        key: idempotencyKey,
        capabilityKeyId: keyResult.key.id,
        responseStatus: 200,
        responseBody: JSON.stringify(responseBody),
        createdAt: now,
      }).onConflictDoNothing();
    }

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    return responseBody;
  }, {
    body: zFileSettingsUpdateRequest,
    response: {
      200: zUpdateFileSettingsResponse,
      400: zError,
      404: zError,
    },
  })
  .get('/w/:key/ops/stats', async ({ params, set, request }) => {
    const key = params.key;

    const rawUrl = request.url;
    if (hasRawPathTraversal(rawUrl)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }
    const keyResult = await validateAndGetKey({ keyString: key, requiredPermission: 'write' });
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return { ok: false, error: keyResult.error };
    }

    const capKey = keyResult.key;

    const stats = await getScopedFileStats({
      workspaceId: keyResult.key.workspaceId,
      scopeType: capKey.scopeType,
      scopePath: capKey.scopePath,
    });

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    return {
      ok: true,
      data: stats,
    };
  }, {
    response: {
      200: zGetStatsViaWriteKeyResponse,
      400: zError,
      404: zError,
    },
  });







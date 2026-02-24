import { Elysia } from 'elysia';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { capabilityKeys, files, idempotencyKeys } from '../../db/schema';
import { generateKey, hashKey } from '../../core/capability-keys';
import { normalizePath, validatePath } from '../../core/path-validation';
import { createErrorResponse } from '../../core/errors';
import { logAction } from '../../services/audit';
import {
  zError,
  zFileMoveRequest,
  zFileMoveResponse,
  zFileRecoverResponse,
  zFileRenameRequest,
  zRecoverFileQuery,
  zRenameFileResponse,
  zRotateCapabilityUrlsResponse,
} from '@mdplane/shared';
import {
  applyIdempotencyReplay,
  createFileDeletedResponse,
  findFileForScope,
  getIdempotencyKey,
  getRequestAuditContext,
  hasRawPathTraversal,
  pathTraversalErrorResponse,
  updateWorkspaceStorage,
  validateAndGetFileKey as validateAndGetKey,
} from '../../shared';
import { serverEnv } from '../../config/env';

const BASE_URL = serverEnv.baseUrl;
const APP_URL = serverEnv.appUrl;

export const filesMutationsLifecycleRoute = new Elysia()  .post('/w/:key/recover', async ({ params, query, set, request }) => {
    const key = params.key;
    const rotateUrls = query.rotateUrls === 'true';

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

    if (!capKey || !capKey.scopePath) {
      set.status = 404;
      return { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
    }

    const file = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        eq(files.path, capKey.scopePath)
      ),
    });

    if (!file || !file.deletedAt) {
      set.status = 404;
      return { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
    }

    // Files are recoverable for 7 days after deletion
    const deletedAt = new Date(file.deletedAt);
    const recoveryWindowMs = 7 * 24 * 60 * 60 * 1000;
    const now = new Date();

    if (now.getTime() - deletedAt.getTime() > recoveryWindowMs) {
      set.status = 404;
      return { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
    }

    const nowIso = now.toISOString();

    await db.update(files)
      .set({ deletedAt: null, updatedAt: nowIso })
      .where(eq(files.id, file.id));

    const fileSize = Buffer.byteLength(file.content, 'utf8');
    updateWorkspaceStorage(keyResult.key.workspaceId, fileSize);

    logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'file.recover',
      resourceType: 'file',
      resourceId: file.id,
      resourcePath: file.path,
      actorType: 'capability_url',
      metadata: { rotateUrls },
      ...getRequestAuditContext(request),
    });

    let readKey: string;
    let appendKey: string;
    let writeKey: string;

    if (rotateUrls) {
      await db.update(capabilityKeys)
        .set({ revokedAt: nowIso })
        .where(and(
          eq(capabilityKeys.workspaceId, keyResult.key.workspaceId),
          eq(capabilityKeys.scopeType, 'file'),
          eq(capabilityKeys.scopePath, file.path)
        ));

      // Generate new capability keys
      readKey = generateKey(22);
      appendKey = generateKey(22);
      writeKey = generateKey(22);

      const keysToInsert = [
        { key: readKey, permission: 'read' as const },
        { key: appendKey, permission: 'append' as const },
        { key: writeKey, permission: 'write' as const },
      ];

      for (const keyData of keysToInsert) {
        const keyHash = hashKey(keyData.key);
        const keyId = generateKey(16);
        await db.insert(capabilityKeys).values({
          id: keyId,
          workspaceId: keyResult.key.workspaceId,
          prefix: keyData.key.substring(0, 4),
          keyHash,
          permission: keyData.permission,
          scopeType: 'file',
          scopePath: file.path,
          createdAt: nowIso,
        });
      }
    } else {
      writeKey = key;
      readKey = key;
      appendKey = key;
    }

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    return {
      ok: true,
      data: {
        id: file.id,
        recovered: true,
        path: file.path,
        urls: {
          read: `${BASE_URL}/r/${readKey}`,
          append: `${BASE_URL}/a/${appendKey}`,
          write: `${BASE_URL}/w/${writeKey}`,
        },
        webUrl: `${APP_URL}/r/${readKey}`,
      },
    };
  }, {
    query: zRecoverFileQuery,
    response: {
      200: zFileRecoverResponse,
      400: zError,
      404: zError,
    },
  })
  // Move file - POST /w/:key/move
  .post('/w/:key/move', async ({ params, body, set, request }) => {
    const key = params.key;

    // Check raw URL for path traversal
    const rawUrl = request.url;
    if (hasRawPathTraversal(rawUrl)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    // Validate and get key - must have write permission
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

    const { source, destination } = body;

    const sourceError = validatePath(source);
    if (sourceError) {
      set.status = 400;
      return { ok: false, error: sourceError };
    }

    const destError = validatePath(destination);
    if (destError) {
      set.status = 400;
      return { ok: false, error: destError };
    }

    const normalizedSource = normalizePath(source);

    const file = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        eq(files.path, normalizedSource),
        isNull(files.deletedAt)
      ),
    });

    if (!file) {
      set.status = 404;
      return { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
    }

    const filename = file.path.split('/').pop() || file.path;

    const normalizedDest = normalizePath(destination);
    const newPath = normalizedDest === '/' ? `/${filename}` : `${normalizedDest}/${filename}`;

    const existingFileAtDest = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        eq(files.path, newPath),
        isNull(files.deletedAt)
      ),
    });

    if (existingFileAtDest) {
      set.status = 409;
      return {
        ok: false,
        error: { code: 'CONFLICT', message: 'A file already exists at the destination' },
      };
    }

    const previousPath = file.path;
    const now = new Date().toISOString();

    // Update file's path in database
    await db.update(files)
      .set({
        path: newPath,
        updatedAt: now,
      })
      .where(eq(files.id, file.id));

    logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'file.move',
      resourceType: 'file',
      resourceId: file.id,
      resourcePath: newPath,
      actorType: 'capability_url',
      metadata: { previousPath },
      ...getRequestAuditContext(request),
    });

    const responseBody = {
      ok: true,
      data: {
        id: file.id,
        previousPath,
        newPath,
        webUrl: `${APP_URL}/w/${key}`,
      },
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
    body: zFileMoveRequest,
    response: {
      200: zFileMoveResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Rotate capability URLs - POST /w/:key/rotate
  .post('/w/:key/rotate', async ({ params, set, request }) => {
    const key = params.key;

    const rawUrl = request.url;
    if (hasRawPathTraversal(rawUrl)) {
      set.status = 400;
      set.headers['Content-Type'] = 'application/json';
      return pathTraversalErrorResponse();
    }

    const keyResult = await validateAndGetKey({ keyString: key, requiredPermission: 'write' });
    if (!keyResult.ok) {
      set.status = keyResult.status;
      set.headers['Content-Type'] = 'application/json';
      return { ok: false, error: keyResult.error };
    }

    let file;
    if (keyResult.key.scopeType === 'file' && keyResult.key.scopePath) {
      file = await db.query.files.findFirst({
        where: and(
          eq(files.workspaceId, keyResult.key.workspaceId),
          eq(files.path, keyResult.key.scopePath!)
        ),
      });
    } else {
      file = await db.query.files.findFirst({
        where: and(
          eq(files.workspaceId, keyResult.key.workspaceId),
          isNull(files.deletedAt)
        ),
        orderBy: (files, { asc }) => [asc(files.createdAt), asc(files.path)],
      });
    }

    if (!file) {
      set.status = 404;
      set.headers['Content-Type'] = 'application/json';
      return { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
    }

    if (file.deletedAt) {
      return createFileDeletedResponse(file.deletedAt, set);
    }

    const nowIso = new Date().toISOString();

    logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'file.rotate_urls',
      resourceType: 'file',
      resourceId: file.id,
      resourcePath: file.path,
      actorType: 'capability_url',
      metadata: {},
      ...getRequestAuditContext(request),
    });

    await db.update(capabilityKeys)
      .set({ revokedAt: nowIso })
      .where(and(
        eq(capabilityKeys.workspaceId, keyResult.key.workspaceId),
        eq(capabilityKeys.scopeType, 'file'),
        eq(capabilityKeys.scopePath, file.path)
      ));

    const readKey = generateKey(22);
    const appendKey = generateKey(22);
    const writeKey = generateKey(22);

    const keysToInsert = [
      { key: readKey, permission: 'read' as const },
      { key: appendKey, permission: 'append' as const },
      { key: writeKey, permission: 'write' as const },
    ];

    for (const keyData of keysToInsert) {
      const keyHash = hashKey(keyData.key);
      const keyId = generateKey(16);
      await db.insert(capabilityKeys).values({
        id: keyId,
        workspaceId: keyResult.key.workspaceId,
        prefix: keyData.key.substring(0, 4),
        keyHash,
        permission: keyData.permission,
        scopeType: 'file',
        scopePath: file.path,
        createdAt: nowIso,
      });
    }

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    return {
      ok: true,
      data: {
        id: file.id,
        urls: {
          read: `${BASE_URL}/r/${readKey}`,
          append: `${BASE_URL}/a/${appendKey}`,
          write: `${BASE_URL}/w/${writeKey}`,
        },
        webUrl: `${APP_URL}/r/${readKey}`,
        previousUrlsInvalidated: true,
      },
    };
  }, {
    response: {
      200: zRotateCapabilityUrlsResponse,
      400: zError,
      404: zError,
      410: zError,
    },
  })
  // Rename file - PATCH /w/:key
  .patch('/w/:key', async ({ params, body, set, request }) => {
    const key = params.key;

    // Check raw URL for path traversal
    const rawUrl = request.url;
    if (hasRawPathTraversal(rawUrl)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    // Validate and get key - must have write permission
    const keyResult = await validateAndGetKey({ keyString: key, requiredPermission: 'write' });
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return { ok: false, error: keyResult.error };
    }

    const idempotencyKey = getIdempotencyKey(request);

    // Check idempotency before processing
    if (idempotencyKey) {
      const existing = await db.query.idempotencyKeys.findFirst({
        where: eq(idempotencyKeys.key, idempotencyKey),
      });

      if (existing && applyIdempotencyReplay(existing, set)) return JSON.parse(existing.responseBody);
    }

    // Body is validated by Elysia using zFileRenameRequest schema
    const filename = body.filename.trim();

    // Validate filename is not empty after trim
    if (!filename) {
      set.status = 400;
      return {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'filename cannot be empty' },
      };
    }

    // Reuse the already-validated capability key for scope resolution
    const capKey = keyResult.key;

    const file = await findFileForScope({ workspaceId: keyResult.key.workspaceId, capKey });

    if (!file) {
      set.status = 404;
      return { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
    }

    // Extract directory from current path
    const pathParts = file.path.split('/');
    pathParts.pop(); // Remove current filename
    const directory = pathParts.join('/') || '/';

    // Construct new path with new filename
    const newPath = directory === '/' ? `/${filename}` : `${directory}/${filename}`;

    // Check if a file already exists at the new path (unless it's the same file)
    if (newPath !== file.path) {
      const existingFileAtPath = await db.query.files.findFirst({
        where: and(
          eq(files.workspaceId, keyResult.key.workspaceId),
          eq(files.path, newPath),
          isNull(files.deletedAt)
        ),
      });

      if (existingFileAtPath) {
        set.status = 409;
        return {
          ok: false,
          error: { code: 'CONFLICT', message: 'A file with that name already exists' },
        };
      }
    }

    const now = new Date().toISOString();

    // Update file's path in database
    await db.update(files)
      .set({
        path: newPath,
        updatedAt: now,
      })
      .where(eq(files.id, file.id));

    // Log audit event for file rename (async, non-blocking)
    logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'file.rename',
      resourceType: 'file',
      resourceId: file.id,
      resourcePath: newPath,
      actorType: 'capability_url',
      metadata: { previousPath: file.path, newFilename: filename },
      ...getRequestAuditContext(request),
    });

    const responseBody = {
      ok: true,
      data: {
        id: file.id,
        filename,
        webUrl: `${APP_URL}/w/${key}`,
      },
    };

    // Store idempotency response
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
    body: zFileRenameRequest,
    response: {
      200: zRenameFileResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Get file settings - GET /w/:key/settings


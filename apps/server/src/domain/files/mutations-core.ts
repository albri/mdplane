import { Elysia } from 'elysia';
import { and, eq, isNull } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { files, idempotencyKeys } from '../../db/schema';
import { normalizePath, validatePath } from '../../core/path-validation';
import { emit } from '../../services/event-bus';
import { logAction } from '../../services/audit';
import { triggerWebhooks } from '../../services/webhook-trigger';
import {
  LIMITS,
  zDeleteFileQuery,
  zError,
  zFileDeleteResponse,
  zFileUpdateRequest,
  zFileUpdateResponse,
} from '@mdplane/shared';
import {
  applyIdempotencyReplay,
  checkWorkspaceQuota,
  computeETag,
  generateRecordId,
  getIdempotencyKey,
  getRequestAuditContext,
  hasRawPathTraversal,
  pathTraversalErrorResponse,
  updateWorkspaceStorage,
  validateAndGetFileKey as validateAndGetKey,
} from '../../shared';
import { serverEnv } from '../../config/env';

const APP_URL = serverEnv.appUrl;

export const filesMutationsCoreRoute = new Elysia()  .put('/w/:key/*', async ({ params, body, set, request }) => {
    const key = params.key;
    const path = (params as Record<string, string>)['*'] || '';

    const rawUrl = request.url;
    if (hasRawPathTraversal(rawUrl)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    const pathError = validatePath(path);
    if (pathError) {
      set.status = 400;
      return { ok: false, error: pathError };
    }

    const keyResult = await validateAndGetKey({
      keyString: key,
      requiredPermission: 'write',
      pathHint: path,
    });
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

    const requestBody = body;

    const normalizedPath = normalizePath(path);
    const now = new Date().toISOString();
    const newContentHash = computeETag(requestBody.content);
    const contentSize = Buffer.byteLength(requestBody.content, 'utf8');

    if (contentSize > LIMITS.FILE_MAX_SIZE_BYTES) {
      set.status = 413;
      set.headers['Content-Type'] = 'application/json';
      set.headers['X-Content-Size-Limit'] = String(LIMITS.FILE_MAX_SIZE_BYTES);
      return {
        ok: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `File content exceeds maximum size of ${LIMITS.FILE_MAX_SIZE_BYTES} bytes`
        }
      };
    }

    const existingFile = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        eq(files.path, normalizedPath),
        isNull(files.deletedAt)
      ),
    });

    // Check workspace storage quota
    const existingContentSize = existingFile ? Buffer.byteLength(existingFile.content, 'utf8') : 0;
    const quotaError = await checkWorkspaceQuota({
      workspaceId: keyResult.key.workspaceId,
      newContentSize: contentSize,
      existingContentSize,
    });
    if (quotaError) {
      set.status = 413;
      set.headers['Content-Type'] = 'application/json';
      return { ok: false, error: quotaError };
    }

    if (existingFile) {
      const currentContentHash = computeETag(existingFile.content);

      const ifMatchHeader = request.headers.get('If-Match');
      if (ifMatchHeader) {
        const providedEtag = ifMatchHeader.replace(/^"|"$/g, '');
        if (providedEtag !== currentContentHash) {
          set.status = 412;
          set.headers['Content-Type'] = 'application/json';
          return {
            ok: false,
            error: {
              code: 'CONFLICT',
              message: 'File was modified since last read',
              details: {
                currentEtag: currentContentHash,
                providedEtag: providedEtag,
              },
            },
          };
        }
      }

      await db.update(files)
        .set({
          content: requestBody.content,
          updatedAt: now,
        })
        .where(eq(files.id, existingFile.id));

      const storageDelta = contentSize - existingContentSize;
      updateWorkspaceStorage(keyResult.key.workspaceId, storageDelta);
      const staleResult = sqlite.query(`
        SELECT COUNT(*) as count FROM appends
        WHERE file_id = ? AND content_hash IS NOT NULL AND content_hash != ?
      `).get(existingFile.id, newContentHash) as { count: number };
      const appendsStale = staleResult?.count ?? 0;

      logAction({
        workspaceId: keyResult.key.workspaceId,
        action: 'file.update',
        resourceType: 'file',
        resourceId: existingFile.id,
        resourcePath: normalizedPath,
        actorType: 'capability_url',
        ...getRequestAuditContext(request),
      });

      triggerWebhooks(
        keyResult.key.workspaceId,
        'file.updated',
        { file: { id: existingFile.id, path: normalizedPath } },
        normalizedPath
      ).catch((err) => console.error('Webhook trigger failed:', err));

      emit({
        type: 'file.updated',
        workspaceId: keyResult.key.workspaceId,
        filePath: normalizedPath,
        data: { fileId: existingFile.id, size: contentSize },
        timestamp: now,
      });

      const responseBody = {
        ok: true,
        data: {
          id: existingFile.id,
          etag: newContentHash,
          updatedAt: now,
          size: contentSize,
          appendsStale,
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
    } else {
      // Create new file - use try-catch to handle race condition where another
      // request creates the same file between our check and insert
      const fileId = generateRecordId();
      try {
        await db.insert(files).values({
          id: fileId,
          workspaceId: keyResult.key.workspaceId,
          path: normalizedPath,
          content: requestBody.content,
          createdAt: now,
          updatedAt: now,
        });

        updateWorkspaceStorage(keyResult.key.workspaceId, contentSize);

        logAction({
          workspaceId: keyResult.key.workspaceId,
          action: 'file.create',
          resourceType: 'file',
          resourceId: fileId,
          resourcePath: normalizedPath,
          actorType: 'capability_url',
          ...getRequestAuditContext(request),
        });

        triggerWebhooks(
          keyResult.key.workspaceId,
          'file.created',
          { file: { id: fileId, path: normalizedPath } },
          normalizedPath
        ).catch((err) => console.error('Webhook trigger failed:', err));

        emit({
          type: 'file.created',
          workspaceId: keyResult.key.workspaceId,
          filePath: normalizedPath,
          data: { fileId, content: requestBody.content },
          timestamp: now,
        });

        const responseBody = {
          ok: true,
          data: {
            id: fileId,
            etag: newContentHash,
            updatedAt: now,
            size: contentSize,
            appendsStale: 0,
            webUrl: `${APP_URL}/w/${key}`,
          },
        };

        if (idempotencyKey) {
          await db.insert(idempotencyKeys).values({
            key: idempotencyKey,
            capabilityKeyId: keyResult.key.id,
            responseStatus: 201,
            responseBody: JSON.stringify(responseBody),
            createdAt: now,
          }).onConflictDoNothing();
        }

        set.status = 201;
        set.headers['Content-Type'] = 'application/json';
        return responseBody;
      } catch (err: unknown) {
        // Handle race condition: another request created the file between our check and insert
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
          const raceFile = await db.query.files.findFirst({
            where: and(
              eq(files.workspaceId, keyResult.key.workspaceId),
              eq(files.path, normalizedPath),
              isNull(files.deletedAt)
            ),
          });

          if (raceFile) {
            await db.update(files)
              .set({
                content: requestBody.content,
                updatedAt: now,
              })
              .where(eq(files.id, raceFile.id));

            const raceFileSize = Buffer.byteLength(raceFile.content, 'utf8');
            const storageDelta = contentSize - raceFileSize;
            updateWorkspaceStorage(keyResult.key.workspaceId, storageDelta);

            logAction({
              workspaceId: keyResult.key.workspaceId,
              action: 'file.update',
              resourceType: 'file',
              resourceId: raceFile.id,
              resourcePath: normalizedPath,
              actorType: 'capability_url',
              ...getRequestAuditContext(request),
            });

            triggerWebhooks(
              keyResult.key.workspaceId,
              'file.updated',
              { file: { id: raceFile.id, path: normalizedPath } },
              normalizedPath
            ).catch((err) => console.error('Webhook trigger failed:', err));

            emit({
              type: 'file.updated',
              workspaceId: keyResult.key.workspaceId,
              filePath: normalizedPath,
              data: { fileId: raceFile.id, size: contentSize },
              timestamp: now,
            });

            const responseBody = {
              ok: true,
              data: {
                id: raceFile.id,
                etag: newContentHash,
                updatedAt: now,
                size: contentSize,
                appendsStale: 0,
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
          }
        }
        // Re-throw if not a UNIQUE constraint error or file not found
        throw err;
      }
    }
  }, {
    body: zFileUpdateRequest,
    response: {
      200: zFileUpdateResponse,
      201: zFileUpdateResponse,
      400: zError,
      404: zError,
      412: zError,
      413: zError,
    },
  })
  // Delete file - DELETE /w/:key/*path
  .delete('/w/:key/*', async ({ params, query, set, request }) => {
    const key = params.key;
    const path = (params as Record<string, string>)['*'] || '';
    const permanent = query.permanent === 'true';

    const rawUrl = request.url;
    if (hasRawPathTraversal(rawUrl)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    const pathError = validatePath(path);
    if (pathError) {
      set.status = 400;
      return { ok: false, error: pathError };
    }

    const keyResult = await validateAndGetKey({
      keyString: key,
      requiredPermission: 'write',
      pathHint: path,
    });
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

    const normalizedPath = normalizePath(path);

    const file = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        eq(files.path, normalizedPath),
        isNull(files.deletedAt)
      ),
    });

    if (!file) {
      set.status = 404;
      return { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
    }

    logAction({
      workspaceId: keyResult.key.workspaceId,
      action: permanent ? 'file.hard_delete' : 'file.delete',
      resourceType: 'file',
      resourceId: file.id,
      resourcePath: normalizedPath,
      actorType: 'capability_url',
      ...getRequestAuditContext(request),
    });

    const fileSize = Buffer.byteLength(file.content, 'utf8');

    if (permanent) {
      await db.delete(files).where(eq(files.id, file.id));

      updateWorkspaceStorage(keyResult.key.workspaceId, -fileSize);

      triggerWebhooks(
        keyResult.key.workspaceId,
        'file.deleted',
        { file: { id: file.id, path: normalizedPath, permanent: true } },
        normalizedPath
      ).catch((err) => console.error('Webhook trigger failed:', err));

      // Emit to EventBus for WebSocket broadcast
      emit({
        type: 'file.deleted',
        workspaceId: keyResult.key.workspaceId,
        filePath: normalizedPath,
        data: { fileId: file.id, permanent: true },
        timestamp: new Date().toISOString(),
      });

      const responseBody = {
        ok: true,
        data: {
          id: file.id,
          deleted: true,
          recoverable: false,
        },
      };

      if (idempotencyKey) {
        await db.insert(idempotencyKeys).values({
          key: idempotencyKey,
          capabilityKeyId: keyResult.key.id,
          responseStatus: 200,
          responseBody: JSON.stringify(responseBody),
          createdAt: new Date().toISOString(),
        }).onConflictDoNothing();
      }

      set.status = 200;
      set.headers['Content-Type'] = 'application/json';
      return responseBody;
    }

    // Files are recoverable for 7 days after deletion
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.update(files)
      .set({ deletedAt: now })
      .where(eq(files.id, file.id));

    updateWorkspaceStorage(keyResult.key.workspaceId, -fileSize);

    triggerWebhooks(
      keyResult.key.workspaceId,
      'file.deleted',
      { file: { id: file.id, path: normalizedPath, recoverable: true, expiresAt } },
      normalizedPath
    ).catch((err) => console.error('Webhook trigger failed:', err));

    emit({
      type: 'file.deleted',
      workspaceId: keyResult.key.workspaceId,
      filePath: normalizedPath,
      data: { fileId: file.id, recoverable: true, expiresAt },
      timestamp: now,
    });

    const responseBody = {
      ok: true,
      data: {
        id: file.id,
        deleted: true,
        recoverable: true,
        expiresAt,
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
    query: zDeleteFileQuery,
    response: {
      200: zFileDeleteResponse,
      400: zError,
      404: zError,
    },
  })


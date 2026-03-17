import { Elysia } from 'elysia';
import { createErrorResponse } from '../../core/errors';
import { logAction } from '../../services/audit';
import { hasRequiredScope, updateApiKeyLastUsed } from '../../shared';
import { z } from 'zod';
import {
  zCreateExportJobResponse,
  zGetExportJobStatusResponse,
  zListDeletedFilesResponse,
  zError,
  zExportWorkspaceQuery as zExportQueryBase,
  zListDeletedFilesQuery,
} from '@mdplane/shared';
import {
  authenticateExportApiKey,
} from './auth';
import {
  buildSyncExportPayload,
  handleCreateJob,
  handleListDeleted,
  handleGetJobStatus,
  handleDownloadJob,
} from './handlers';
import { VALID_FORMATS, type ExportFormat } from './types';

const zExportQuery = zExportQueryBase.extend({
  paths: z.preprocess(
    (val) => (Array.isArray(val) ? val.join(',') : val),
    z.string().optional()
  ),
});

export const exportRoute = new Elysia()
  .get('/api/v1/export', async ({ query, set, request }) => {
    const keyResult = authenticateExportApiKey(request);
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return createErrorResponse(keyResult.error.code, keyResult.error.message);
    }

    if (!hasRequiredScope(keyResult.key.scopes, 'export')) {
      set.status = 403;
      return createErrorResponse('PERMISSION_DENIED', 'API key requires export scope');
    }

    updateApiKeyLastUsed(keyResult.key.id);

    const { format, includeAppends, includeDeleted, paths } = query;
    const filterPaths = paths ? paths.split(',').map(p => p.trim()) : null;

    const result = buildSyncExportPayload({
      workspaceId: keyResult.key.workspaceId,
      format: format as ExportFormat,
      includeAppends: includeAppends === 'true',
      includeDeleted: includeDeleted === 'true',
      filterPaths,
    });

    await logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'export.sync',
      resourceType: 'export',
      actorType: 'api_key',
      actor: keyResult.key.id,
      metadata: {
        format,
        fileCount: result.fileCount,
        sizeBytes: result.contentBuffer.length,
        checksum: result.checksum,
        includeAppends: includeAppends === 'true',
        includeDeleted: includeDeleted === 'true',
        pathsFilter: filterPaths,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    set.status = 200;
    set.headers['Content-Type'] = result.contentType;
    set.headers['Content-Disposition'] = `attachment; filename="${result.filename}"`;
    set.headers['X-Export-Checksum'] = result.checksum;

    return result.contentBuffer;
  }, {
    query: zExportQuery,
  })

  .post('/api/v1/export/jobs', async ({ body, set, request }) => {
    const keyResult = authenticateExportApiKey(request);
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return createErrorResponse(keyResult.error.code, keyResult.error.message);
    }

    if (!hasRequiredScope(keyResult.key.scopes, 'export')) {
      set.status = 403;
      return createErrorResponse('PERMISSION_DENIED', 'API key requires export scope');
    }

    updateApiKeyLastUsed(keyResult.key.id);

    const requestBody = body as { format?: string; include?: string[]; notifyEmail?: string; folder?: string } | null;
    const format = (requestBody?.format || 'zip') as ExportFormat;

    const result = handleCreateJob({
      workspaceId: keyResult.key.workspaceId,
      format,
      include: requestBody?.include,
      notifyEmail: requestBody?.notifyEmail,
      folder: requestBody?.folder,
    });

    if (!result.ok) {
      set.status = result.status;
      return createErrorResponse(result.error.code, result.error.message);
    }

    await logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'export.job_created',
      resourceType: 'export',
      resourceId: result.data.jobId,
      actorType: 'api_key',
      actor: keyResult.key.id,
      metadata: {
        format,
        estimatedSize: result.data.estimatedSize,
        position: result.data.position,
        notifyEmail: requestBody?.notifyEmail ? '[redacted]' : undefined,
        folder: requestBody?.folder,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    set.status = 202;
    return { ok: true as const, data: result.data };
  }, {
    response: {
      202: zCreateExportJobResponse,
      400: zError,
      401: zError,
      403: zError,
      413: zError,
    },
  })

  .get('/api/v1/deleted', async ({ query, set, request }) => {
    const keyResult = authenticateExportApiKey(request);
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return createErrorResponse(keyResult.error.code, keyResult.error.message);
    }

    if (!hasRequiredScope(keyResult.key.scopes, 'export')) {
      set.status = 403;
      return createErrorResponse('PERMISSION_DENIED', 'API key requires export scope');
    }

    updateApiKeyLastUsed(keyResult.key.id);

    const { limit, cursor } = query;
    const result = handleListDeleted({ workspaceId: keyResult.key.workspaceId, limit, cursor });

    set.status = 200;
    return { ok: true as const, data: { files: result.files }, pagination: result.pagination };
  }, {
    query: zListDeletedFilesQuery,
    response: {
      200: zListDeletedFilesResponse,
      401: zError,
      403: zError,
    },
  })

  .get('/api/v1/export/jobs/:jobId', async ({ params, set, request }) => {
    const keyResult = authenticateExportApiKey(request);
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return createErrorResponse(keyResult.error.code, keyResult.error.message);
    }

    if (!hasRequiredScope(keyResult.key.scopes, 'export')) {
      set.status = 403;
      return createErrorResponse('PERMISSION_DENIED', 'API key requires export scope');
    }

    updateApiKeyLastUsed(keyResult.key.id);

    const result = handleGetJobStatus({ jobId: params.jobId, workspaceId: keyResult.key.workspaceId });
    if (!result.ok) {
      set.status = result.status;
      return createErrorResponse(result.error.code, result.error.message);
    }

    set.status = 200;
    return { ok: true as const, data: result.data };
  }, {
    response: {
      200: zGetExportJobStatusResponse,
      401: zError,
      403: zError,
      404: zError,
    },
  })

  .get('/api/v1/export/jobs/:jobId/download', async ({ params, set, request }) => {
    const keyResult = authenticateExportApiKey(request);
    if (!keyResult.ok) {
      set.status = keyResult.status;
      return createErrorResponse(keyResult.error.code, keyResult.error.message);
    }

    if (!hasRequiredScope(keyResult.key.scopes, 'export')) {
      set.status = 403;
      return createErrorResponse('PERMISSION_DENIED', 'API key requires export scope');
    }

    updateApiKeyLastUsed(keyResult.key.id);

    const result = handleDownloadJob({ jobId: params.jobId, workspaceId: keyResult.key.workspaceId });
    if (!result.ok) {
      set.status = result.status;
      return createErrorResponse(result.error.code, result.error.message, result.error.details);
    }

    await logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'export.download',
      resourceType: 'export',
      resourceId: result.data.jobId,
      actorType: 'api_key',
      actor: keyResult.key.id,
      metadata: {
        fileCount: result.data.fileCount,
        sizeBytes: result.data.contentBuffer.length,
        checksum: result.data.checksum,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    set.status = 200;
    set.headers['Content-Type'] = result.data.contentType;
    set.headers['Content-Disposition'] = `attachment; filename="${result.data.filename}"`;
    set.headers['X-Export-Checksum'] = result.data.checksum;

    return result.data.contentBuffer;
  });


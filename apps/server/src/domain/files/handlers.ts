import { createErrorResponse } from '../../core/errors';
import { normalizePath, validatePath } from '../../core/path-validation';
import {
  findFileForScope,
  hasRawPathTraversal,
  pathTraversalErrorResponse,
  validateAndGetFileKey as validateAndGetKey,
} from '../../shared';
import { getAppendById, getFileStats } from './stats';
import { readFile } from './read';
import type {
  GetAppendByKeyResult,
  GetFileStatsByKeyResult,
  ReadFileByKeyResult,
  ReadFileQueryInput,
} from './types';

function toTraversalErrorResult() {
  const response = pathTraversalErrorResponse();
  return {
    ok: false as const,
    status: 400,
    error: response.error,
  };
}

export async function handleGetFileStatsByKey(input: {
  key: string;
  rawUrl: string;
}): Promise<GetFileStatsByKeyResult> {
  if (hasRawPathTraversal(input.rawUrl)) {
    return toTraversalErrorResult();
  }

  const keyResult = await validateAndGetKey({ keyString: input.key });
  if (!keyResult.ok) {
    return { ok: false, status: keyResult.status, error: keyResult.error };
  }

  const file = await findFileForScope({
    workspaceId: keyResult.key.workspaceId,
    capKey: keyResult.key,
    options: { includeDeleted: true },
  });

  if (!file) {
    return { ok: false, status: 404, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
  }

  if (file.deletedAt) {
    return {
      ok: false,
      status: 410,
      error: { code: 'FILE_DELETED', message: 'File is soft-deleted' },
      deletedAt: file.deletedAt,
    };
  }

  const result = await getFileStats({ workspaceId: keyResult.key.workspaceId, fileId: file.id });
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  return { ok: true, data: result.data };
}

export async function handleGetAppendByKey(input: {
  key: string;
  appendId: string;
}): Promise<GetAppendByKeyResult> {
  if (!/^a\d+$/.test(input.appendId)) {
    return { ok: false, status: 400, error: { code: 'INVALID_APPEND_ID', message: 'Invalid append ID format' } };
  }

  const keyResult = await validateAndGetKey({ keyString: input.key });
  if (!keyResult.ok) {
    return { ok: false, status: keyResult.status, error: keyResult.error };
  }

  const result = await getAppendById({
    workspaceId: keyResult.key.workspaceId,
    scopeType: keyResult.key.scopeType,
    scopePath: keyResult.key.scopePath,
    appendId: input.appendId,
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: result.error,
      deletedAt: result.deletedAt,
    };
  }

  return { ok: true, data: result.data };
}

export async function handleReadFileByKey(input: {
  key: string;
  path: string;
  rawUrl: string;
  keyPrefix: 'r' | 'w';
  query: ReadFileQueryInput;
  requiredPermission?: 'write';
}): Promise<ReadFileByKeyResult> {
  if (hasRawPathTraversal(input.rawUrl)) {
    return toTraversalErrorResult();
  }

  const pathError = validatePath(input.path);
  if (pathError) {
    const errorResponse = createErrorResponse(pathError.code, pathError.message ?? 'Invalid path');
    return { ok: false, status: 400, error: errorResponse.error };
  }

  const keyResult = await validateAndGetKey({
    keyString: input.key,
    requiredPermission: input.requiredPermission,
    pathHint: input.path,
  });
  if (!keyResult.ok) {
    return { ok: false, status: keyResult.status, error: keyResult.error };
  }

  const normalizedPath = normalizePath(input.path);
  const result = await readFile({
    workspaceId: keyResult.key.workspaceId,
    scopeType: keyResult.key.scopeType,
    scopePath: keyResult.key.scopePath,
    normalizedPath,
    key: input.key,
    keyPrefix: input.keyPrefix,
    appendsLimit: input.query.appends,
    format: input.query.format,
    include: input.query.include,
    since: input.query.since,
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: result.error,
      deletedAt: result.deletedAt,
    };
  }

  return { ok: true, data: result.data, etag: result.etag };
}

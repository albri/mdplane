import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { capabilityKeys, files, idempotencyKeys } from '../../db/schema';
import { hashKey, generateKey, validateKey } from '../../core/capability-keys';
import { validatePath, normalizeFolderPath } from '../../core/path-validation';
import { logAction } from '../../services/audit';
import type { HandlerResponse } from '../../shared';
import {
  generateFileId,
  generateRecordId,
  validateFilename,
} from '../../shared';
import type {
  CreateFileRequest,
  CopyFileToFolderRequest,
  FolderBulkCreateRequest,
} from '@mdplane/shared';
import { serverEnv } from '../../config/env';
import { validateAndGetKey } from './validation';

const BASE_URL = serverEnv.baseUrl;
const APP_URL = serverEnv.appUrl;

type HandleCreateFileInFolderInput = {
  key: string;
  folderPathParam: string;
  body: CreateFileRequest;
  idempotencyKey: string | null;
  request: Request;
};

export async function handleCreateFileInFolder({
  key,
  folderPathParam,
  body,
  idempotencyKey,
  request,
}: HandleCreateFileInFolderInput): Promise<HandlerResponse> {
  const pathError = validatePath(folderPathParam);
  if (pathError) {
    return { status: 400, body: { ok: false, error: pathError } };
  }

  const keyResult = await validateAndGetKey({
    keyString: key,
    pathHint: folderPathParam,
    requiredPermission: 'append',
  });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const { filename, content } = body;

  const filenameError = validateFilename(filename);
  if (filenameError) {
    return { status: 400, body: { ok: false, error: filenameError } };
  }

  const folderPath = normalizeFolderPath(folderPathParam);
  const filePath = folderPath === '/' ? `/${filename}` : `${folderPath}${filename}`;

  if (idempotencyKey) {
    const existing = await db.query.idempotencyKeys.findFirst({
      where: eq(idempotencyKeys.key, idempotencyKey),
    });
    if (existing) {
      return {
        status: existing.responseStatus,
        body: JSON.parse(existing.responseBody),
        headers: { 'Idempotency-Replayed': 'true' },
      };
    }
  }

  const now = new Date().toISOString();

  const existingFile = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      eq(files.path, filePath),
      isNull(files.deletedAt)
    ),
  });

  if (existingFile) {
    const response = {
      status: 409,
      body: {
        ok: false as const,
        error: {
          code: 'FILE_ALREADY_EXISTS' as const,
          message: `File '${filename}' already exists in folder '${folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath}'`,
          details: {
            filename,
            folder: folderPath.endsWith('/') && folderPath !== '/' ? folderPath.slice(0, -1) : folderPath,
            existingFileId: existingFile.id.substring(0, 5),
          },
        },
      },
    };

    if (idempotencyKey) {
      await db.insert(idempotencyKeys).values({
        key: idempotencyKey,
        capabilityKeyId: keyResult.key.id,
        responseStatus: response.status,
        responseBody: JSON.stringify(response.body),
        createdAt: now,
      });
    }

    return response;
  }

  const fileId = generateFileId();
  const dbFileId = generateRecordId();

  const readKey = generateKey();
  const appendKey = generateKey();
  const writeKey = generateKey();

  const readKeyHash = hashKey(readKey);
  const appendKeyHash = hashKey(appendKey);
  const writeKeyHash = hashKey(writeKey);

  await db.insert(files).values({
    id: dbFileId,
    workspaceId: keyResult.key.workspaceId,
    path: filePath,
    content: content,
    createdAt: now,
    updatedAt: now,
  });

  const keyRecords = [
    { key: readKey, hash: readKeyHash, permission: 'read' as const },
    { key: appendKey, hash: appendKeyHash, permission: 'append' as const },
    { key: writeKey, hash: writeKeyHash, permission: 'write' as const },
  ];

  for (const keyData of keyRecords) {
    const keyId = generateRecordId();
    await db.insert(capabilityKeys).values({
      id: keyId,
      workspaceId: keyResult.key.workspaceId,
      prefix: keyData.key.substring(0, 4),
      keyHash: keyData.hash,
      permission: keyData.permission,
      scopeType: 'file',
      scopePath: filePath,
      createdAt: now,
    });
  }

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'file.create',
    resourceType: 'file',
    resourceId: dbFileId,
    resourcePath: filePath,
    actorType: 'capability_url',
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  const responseBody = {
    ok: true,
    data: {
      id: fileId,
      filename,
      path: filePath,
      urls: {
        read: `${BASE_URL}/r/${readKey}`,
        append: `${BASE_URL}/a/${appendKey}`,
        write: `${BASE_URL}/w/${writeKey}`,
      },
      webUrl: `${APP_URL}/r/${readKey}`,
      createdAt: now,
    },
  };

  const response = { status: 201 as const, body: responseBody };

  if (idempotencyKey) {
    await db.insert(idempotencyKeys).values({
      key: idempotencyKey,
      capabilityKeyId: keyResult.key.id,
      responseStatus: response.status,
      responseBody: JSON.stringify(response.body),
      createdAt: now,
    });
  }

  return response;
}

type HandleCopyFileToFolderInput = {
  key: string;
  folderPathParam: string;
  body: CopyFileToFolderRequest;
  request: Request;
};

export async function handleCopyFileToFolder({
  key,
  folderPathParam,
  body,
  request,
}: HandleCopyFileToFolderInput): Promise<HandlerResponse> {
  const pathError = validatePath(folderPathParam);
  if (pathError) {
    return { status: 400, body: { ok: false, error: pathError } };
  }

  const keyResult = await validateAndGetKey({
    keyString: key,
    pathHint: folderPathParam,
    requiredPermission: 'append',
  });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const { sourceKey, filename: customFilename } = body;

  if (!sourceKey || sourceKey.length < 20 || !validateKey(sourceKey, 'root')) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'SOURCE_NOT_FOUND', message: 'Source file not found' } },
    };
  }

  const sourceKeyHash = hashKey(sourceKey);
  const sourceKeyRecord = await db.query.capabilityKeys.findFirst({
    where: eq(capabilityKeys.keyHash, sourceKeyHash),
  });

  if (!sourceKeyRecord) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'SOURCE_NOT_FOUND', message: 'Source file not found' } },
    };
  }

  const now = new Date().toISOString();
  if (sourceKeyRecord.expiresAt && sourceKeyRecord.expiresAt < now) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'SOURCE_NOT_FOUND', message: 'Source file not found' } },
    };
  }
  if (sourceKeyRecord.revokedAt) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'SOURCE_NOT_FOUND', message: 'Source file not found' } },
    };
  }

  if (sourceKeyRecord.scopeType !== 'file' || !sourceKeyRecord.scopePath) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'SOURCE_NOT_FOUND', message: 'Source file not found' } },
    };
  }

  const sourceFile = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, sourceKeyRecord.workspaceId),
      eq(files.path, sourceKeyRecord.scopePath),
      isNull(files.deletedAt)
    ),
  });

  if (!sourceFile) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'SOURCE_NOT_FOUND', message: 'Source file not found' } },
    };
  }

  const sourceFilename = sourceFile.path.split('/').pop() || 'file.md';
  const filename = customFilename || sourceFilename;

  const filenameError = validateFilename(filename);
  if (filenameError) {
    return { status: 400, body: { ok: false, error: filenameError } };
  }

  const folderPath = normalizeFolderPath(folderPathParam);
  const filePath = folderPath === '/' ? `/${filename}` : `${folderPath}${filename}`;

  const existingFile = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      eq(files.path, filePath),
      isNull(files.deletedAt)
    ),
  });

  if (existingFile) {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: 'FILE_ALREADY_EXISTS',
          message: `File '${filename}' already exists in folder '${folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath}'`,
          details: {
            filename,
            folder: folderPath.endsWith('/') && folderPath !== '/' ? folderPath.slice(0, -1) : folderPath,
            existingFileId: existingFile.id.substring(0, 5),
          },
        },
      },
    };
  }

  const fileId = generateFileId();
  const dbFileId = generateRecordId();

  const readKey = generateKey();
  const appendKey = generateKey();
  const writeKey = generateKey();

  const readKeyHash = hashKey(readKey);
  const appendKeyHash = hashKey(appendKey);
  const writeKeyHash = hashKey(writeKey);

  await db.insert(files).values({
    id: dbFileId,
    workspaceId: keyResult.key.workspaceId,
    path: filePath,
    content: sourceFile.content,
    createdAt: now,
    updatedAt: now,
  });

  const keyRecords = [
    { key: readKey, hash: readKeyHash, permission: 'read' as const },
    { key: appendKey, hash: appendKeyHash, permission: 'append' as const },
    { key: writeKey, hash: writeKeyHash, permission: 'write' as const },
  ];

  for (const keyData of keyRecords) {
    const keyId = generateRecordId();
    await db.insert(capabilityKeys).values({
      id: keyId,
      workspaceId: keyResult.key.workspaceId,
      prefix: keyData.key.substring(0, 4),
      keyHash: keyData.hash,
      permission: keyData.permission,
      scopeType: 'file',
      scopePath: filePath,
      createdAt: now,
    });
  }

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'file.create',
    resourceType: 'file',
    resourceId: dbFileId,
    resourcePath: filePath,
    actorType: 'capability_url',
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    metadata: { operation: 'copy', sourceFile: sourceFile.path },
  });

  return {
    status: 201,
    body: {
      ok: true,
      data: {
        id: fileId,
        filename,
        path: filePath,
        urls: {
          read: `${BASE_URL}/r/${readKey}`,
          append: `${BASE_URL}/a/${appendKey}`,
          write: `${BASE_URL}/w/${writeKey}`,
        },
        webUrl: `${APP_URL}/r/${readKey}`,
        createdAt: now,
      },
    },
  };
}

type HandleBulkCreateFilesInput = {
  key: string;
  folderPathParam: string;
  body: FolderBulkCreateRequest;
  asyncMode: boolean;
  request: Request;
};

export async function handleBulkCreateFiles({
  key,
  folderPathParam,
  body,
  asyncMode,
  request,
}: HandleBulkCreateFilesInput): Promise<HandlerResponse> {
  const pathError = validatePath(folderPathParam);
  if (pathError) {
    return { status: 400, body: { ok: false, error: pathError } };
  }

  const keyResult = await validateAndGetKey({
    keyString: key,
    pathHint: folderPathParam,
    requiredPermission: 'append',
  });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  if (!body.files || body.files.length === 0) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'files array is required and must not be empty' } },
    };
  }

  if (body.files.length > 100) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'Maximum 100 files per request' } },
    };
  }

  if (asyncMode) {
    const jobId = 'job_' + generateRecordId();
    return {
      status: 202,
      body: { ok: true, data: { jobId } },
    };
  }

  const created: Array<{
    filename: string;
    id: string;
    urls: { read: string; append: string; write: string };
    webUrl: string;
  }> = [];
  const now = new Date().toISOString();
  const normalizedFolderPath = normalizeFolderPath(folderPathParam);

  for (const file of body.files) {
    const filenameError = validateFilename(file.filename);
    if (filenameError) {
      return { status: 400, body: { ok: false, error: filenameError } };
    }
  }

  for (const file of body.files) {
    const filePath = normalizedFolderPath === '/' ? `/${file.filename}` : `${normalizedFolderPath}${file.filename}`;

    const existingFile = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        eq(files.path, filePath),
        isNull(files.deletedAt)
      ),
    });

    if (existingFile) {
      return {
        status: 409,
        body: {
          ok: false,
          error: {
            code: 'FILE_ALREADY_EXISTS',
            message: `File '${file.filename}' already exists`,
            details: { filename: file.filename },
          },
        },
      };
    }

    const fileId = generateFileId();
    const dbFileId = generateRecordId();

    const readKey = generateKey();
    const appendKey = generateKey();
    const writeKey = generateKey();

    const readKeyHash = hashKey(readKey);
    const appendKeyHash = hashKey(appendKey);
    const writeKeyHash = hashKey(writeKey);

    await db.insert(files).values({
      id: dbFileId,
      workspaceId: keyResult.key.workspaceId,
      path: filePath,
      content: file.content || '',
      createdAt: now,
      updatedAt: now,
    });

    const keyRecords = [
      { key: readKey, hash: readKeyHash, permission: 'read' as const },
      { key: appendKey, hash: appendKeyHash, permission: 'append' as const },
      { key: writeKey, hash: writeKeyHash, permission: 'write' as const },
    ];

    for (const keyData of keyRecords) {
      const keyId = generateRecordId();
      await db.insert(capabilityKeys).values({
        id: keyId,
        workspaceId: keyResult.key.workspaceId,
        prefix: keyData.key.substring(0, 4),
        keyHash: keyData.hash,
        permission: keyData.permission,
        scopeType: 'file',
        scopePath: filePath,
        createdAt: now,
      });
    }

    logAction({
      workspaceId: keyResult.key.workspaceId,
      action: 'file.create',
      resourceType: 'file',
      resourceId: dbFileId,
      resourcePath: filePath,
      actorType: 'capability_url',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { operation: 'bulk_create' },
    });

    created.push({
      filename: file.filename,
      id: fileId,
      urls: {
        read: `${BASE_URL}/r/${readKey}`,
        append: `${BASE_URL}/a/${appendKey}`,
        write: `${BASE_URL}/w/${writeKey}`,
      },
      webUrl: `${APP_URL}/r/${readKey}`,
    });
  }

  const parentFolderUrlPath = normalizedFolderPath === '/' ? '' : normalizedFolderPath.substring(1);
  const parentWebUrl = `${APP_URL}/r/${key}/folders${parentFolderUrlPath ? `/${parentFolderUrlPath}` : ''}`;

  return {
    status: 201,
    body: { ok: true, data: { created, webUrl: parentWebUrl } },
  };
}

import { and, eq, isNull, like } from 'drizzle-orm';
import { db } from '../../db';
import { files, folders, webhooks } from '../../db/schema';
import { isUrlBlocked } from '../../core/ssrf';
import { normalizeFolderPath, validatePath } from '../../core/path-validation';
import { logAction } from '../../services/audit';
import type { CapabilityKeyRecord } from '../../shared';
import {
  generateWebhookId,
  generateWebhookSecret,
  validateCapabilityKeyForCapabilityRoute,
} from '../../shared';
import type {
  FolderWebhookCreateInput,
  FolderWebhookDeleteInput,
  FolderWebhookListInput,
  FolderWebhooksRouteResult,
  FolderWebhookUpdateInput,
  ValidateAndGetKeyFunction,
} from './types';

const MAX_WEBHOOKS_PER_FOLDER = 10;

const validateAndGetKey: ValidateAndGetKeyFunction = async ({
  keyString,
  pathHint,
  requiredPermission,
}) =>
  validateCapabilityKeyForCapabilityRoute({
    keyString,
    lookupByHash: async (keyHash) => {
      const keyRecord = await db.query.capabilityKeys.findFirst({
        where: (fields, { eq: eqField }) => eqField(fields.keyHash, keyHash),
      });
      return keyRecord as CapabilityKeyRecord | null;
    },
    pathHint,
    requiredPermission,
  });

function parseFolderScope({ path }: { path: string }): {
  folderPathParam: string;
  folderPath: string;
  dbScopePath: string;
} {
  const folderPathParam = decodeURIComponent(path || '');
  const folderPath = normalizeFolderPath(folderPathParam);
  const folderPathNoSlash =
    folderPath.endsWith('/') && folderPath !== '/'
      ? folderPath.slice(0, -1)
      : folderPath === '/'
        ? ''
        : folderPath;

  return {
    folderPathParam,
    folderPath,
    dbScopePath: folderPathNoSlash || '/',
  };
}

function validateFolderPath({
  folderPathParam,
}: {
  folderPathParam: string;
}): FolderWebhooksRouteResult | null {
  const pathError = validatePath(folderPathParam);
  if (pathError) {
    return {
      status: 400,
      body: { ok: false, error: pathError },
    };
  }
  return null;
}

export async function createFolderWebhook({
  keyString,
  path,
  body,
}: FolderWebhookCreateInput): Promise<FolderWebhooksRouteResult> {
  const { folderPathParam, folderPath, dbScopePath } = parseFolderScope({ path });
  const pathValidation = validateFolderPath({ folderPathParam });
  if (pathValidation) {
    return pathValidation;
  }

  const keyResult = await validateAndGetKey({
    keyString,
    pathHint: folderPathParam,
    requiredPermission: 'write',
  });
  if (!keyResult.ok) {
    return {
      status: keyResult.status,
      body: { ok: false, error: keyResult.error },
    };
  }

  const filesInFolder = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      isNull(files.deletedAt),
      like(files.path, folderPath + '%')
    ),
  });

  const explicitFolder =
    folderPath !== '/'
      ? await db.query.folders.findFirst({
          where: and(
            eq(folders.workspaceId, keyResult.key.workspaceId),
            eq(folders.path, dbScopePath === '/' ? '' : dbScopePath),
            isNull(folders.deletedAt)
          ),
        })
      : null;

  if (folderPath !== '/' && !filesInFolder && !explicitFolder) {
    return {
      status: 404,
      body: {
        ok: false,
        error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' },
      },
    };
  }

  if (isUrlBlocked(body.url)) {
    return {
      status: 400,
      body: {
        ok: false,
        error: {
          code: 'INVALID_WEBHOOK_URL',
          message: 'URL is not allowed (SSRF protection)',
        },
      },
    };
  }

  const existingWebhooks = await db.query.webhooks.findMany({
    where: and(
      eq(webhooks.workspaceId, keyResult.key.workspaceId),
      eq(webhooks.scopeType, 'folder'),
      eq(webhooks.scopePath, dbScopePath),
      isNull(webhooks.deletedAt)
    ),
  });
  if (existingWebhooks.length >= MAX_WEBHOOKS_PER_FOLDER) {
    return {
      status: 429,
      body: {
        ok: false,
        error: {
          code: 'WEBHOOK_LIMIT_EXCEEDED',
          message: `Maximum ${MAX_WEBHOOKS_PER_FOLDER} webhooks per folder`,
        },
      },
    };
  }

  const webhookId = generateWebhookId();
  const secret = body.secret ?? generateWebhookSecret();
  const now = new Date().toISOString();
  const recursive = body.recursive ?? true;

  await db.insert(webhooks).values({
    id: webhookId,
    workspaceId: keyResult.key.workspaceId,
    scopeType: 'folder',
    scopePath: dbScopePath,
    url: body.url,
    events: JSON.stringify(body.events),
    secretHash: secret,
    recursive: recursive ? 1 : 0,
    createdAt: now,
    failureCount: 0,
  });

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'webhook.create',
    resourceType: 'webhook',
    resourceId: webhookId,
    resourcePath: dbScopePath,
    actorType: 'capability_url',
    metadata: {
      url: body.url,
      events: body.events,
      scopeType: 'folder',
      scopePath: dbScopePath,
      recursive,
    },
  });

  return {
    status: 201,
    body: {
      ok: true,
      data: {
        id: webhookId,
        url: body.url,
        events: body.events,
        secret,
        recursive,
        createdAt: now,
        status: 'active',
      },
    },
  };
}

export async function listFolderWebhooks({
  keyString,
  path,
}: FolderWebhookListInput): Promise<FolderWebhooksRouteResult> {
  const { folderPathParam, dbScopePath } = parseFolderScope({ path });
  const pathValidation = validateFolderPath({ folderPathParam });
  if (pathValidation) {
    return pathValidation;
  }

  const keyResult = await validateAndGetKey({
    keyString,
    pathHint: folderPathParam,
    requiredPermission: 'write',
  });
  if (!keyResult.ok) {
    return {
      status: keyResult.status,
      body: { ok: false, error: keyResult.error },
    };
  }

  const dbWebhooks = await db.query.webhooks.findMany({
    where: and(
      eq(webhooks.workspaceId, keyResult.key.workspaceId),
      eq(webhooks.scopeType, 'folder'),
      eq(webhooks.scopePath, dbScopePath),
      isNull(webhooks.deletedAt)
    ),
  });

  return {
    status: 200,
    body: {
      ok: true,
      data: dbWebhooks.map((webhook) => ({
        id: webhook.id,
        url: webhook.url,
        events: JSON.parse(webhook.events) as string[],
        recursive: webhook.recursive === 1,
        createdAt: webhook.createdAt,
        failureCount: webhook.failureCount ?? 0,
        status: webhook.disabledAt ? 'paused' : 'active',
      })),
    },
  };
}

export async function deleteFolderWebhook({
  keyString,
  path,
  webhookId,
}: FolderWebhookDeleteInput): Promise<FolderWebhooksRouteResult> {
  const { folderPathParam } = parseFolderScope({ path });
  const keyResult = await validateAndGetKey({
    keyString,
    pathHint: folderPathParam,
    requiredPermission: 'write',
  });
  if (!keyResult.ok) {
    return {
      status: keyResult.status,
      body: { ok: false, error: keyResult.error },
    };
  }

  const webhook = await db.query.webhooks.findFirst({
    where: and(
      eq(webhooks.id, webhookId),
      eq(webhooks.workspaceId, keyResult.key.workspaceId),
      eq(webhooks.scopeType, 'folder'),
      isNull(webhooks.deletedAt)
    ),
  });
  if (!webhook) {
    return {
      status: 404,
      body: {
        ok: false,
        error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
      },
    };
  }

  await db
    .update(webhooks)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(webhooks.id, webhookId));

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'webhook.delete',
    resourceType: 'webhook',
    resourceId: webhookId,
    actorType: 'capability_url',
  });

  return {
    status: 200,
    body: { ok: true, data: { id: webhookId, deleted: true } },
  };
}

export async function updateFolderWebhook({
  keyString,
  path,
  webhookId,
  body,
}: FolderWebhookUpdateInput): Promise<FolderWebhooksRouteResult> {
  const { folderPathParam } = parseFolderScope({ path });
  const keyResult = await validateAndGetKey({
    keyString,
    pathHint: folderPathParam,
    requiredPermission: 'write',
  });
  if (!keyResult.ok) {
    return {
      status: keyResult.status,
      body: { ok: false, error: keyResult.error },
    };
  }

  const webhook = await db.query.webhooks.findFirst({
    where: and(
      eq(webhooks.id, webhookId),
      eq(webhooks.workspaceId, keyResult.key.workspaceId),
      eq(webhooks.scopeType, 'folder'),
      isNull(webhooks.deletedAt)
    ),
  });
  if (!webhook) {
    return {
      status: 404,
      body: {
        ok: false,
        error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
      },
    };
  }

  if (body.url) {
    if (body.url.length > 2000) {
      return {
        status: 400,
        body: {
          ok: false,
          error: {
            code: 'INVALID_WEBHOOK_URL',
            message: 'URL exceeds maximum length of 2000 characters',
          },
        },
      };
    }

    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(body.url)) {
      return {
        status: 400,
        body: {
          ok: false,
          error: {
            code: 'INVALID_WEBHOOK_URL',
            message: 'URL contains invalid control characters',
          },
        },
      };
    }

    if (isUrlBlocked(body.url)) {
      return {
        status: 400,
        body: {
          ok: false,
          error: {
            code: 'INVALID_WEBHOOK_URL',
            message: 'URL is not allowed (SSRF protection)',
          },
        },
      };
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.url !== undefined) {
    updates.url = body.url;
  }
  if (body.events !== undefined) {
    updates.events = JSON.stringify(body.events);
  }
  if (body.active !== undefined) {
    updates.disabledAt = body.active ? null : new Date().toISOString();
  }
  if (body.secret !== undefined) {
    updates.secretHash = body.secret;
  }
  if (body.recursive !== undefined) {
    updates.recursive = body.recursive ? 1 : 0;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(webhooks).set(updates).where(eq(webhooks.id, webhookId));
  }

  const updatedWebhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.id, webhookId),
  });
  if (!updatedWebhook) {
    return {
      status: 404,
      body: {
        ok: false,
        error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
      },
    };
  }

  logAction({
    workspaceId: keyResult.key.workspaceId,
    action: 'webhook.update',
    resourceType: 'webhook',
    resourceId: webhookId,
    actorType: 'capability_url',
    metadata: { updates: Object.keys(updates) },
  });

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        id: updatedWebhook.id,
        url: updatedWebhook.url,
        events: JSON.parse(updatedWebhook.events) as string[],
        recursive: updatedWebhook.recursive === 1,
        status: updatedWebhook.disabledAt ? 'paused' : 'active',
        createdAt: updatedWebhook.createdAt,
        failureCount: updatedWebhook.failureCount ?? 0,
      },
    },
  };
}

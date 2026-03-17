import { eq, and, isNull, desc, gt } from 'drizzle-orm';
import { db } from '../../db';
import { webhooks, webhookDeliveries } from '../../db/schema';
import { logAction } from '../../services/audit';
import { serverEnv } from '../../config/env';
import { generateWebhookId, generateWebhookSecret, deliverWebhook } from './delivery';
import { validateWebhookUrl } from './validation';
import type {
  WebhookEvent,
  CreateWebhookInput,
  CreateWebhookData,
  DeleteWebhookInput,
  WebhookDeleteData,
  WebhookListData,
  WebhookLogsData,
  WebhookTestData,
  WebhookUpdateData,
  UpdateWebhookInput,
  TestWebhookInput,
  GetLogsInput,
  WebhookAuditContext,
} from './types';

const APP_URL = serverEnv.appUrl;

type WebhookErrorCode = 'WEBHOOK_NOT_FOUND' | 'INVALID_WEBHOOK_URL';

export type HandlerResult<T> =
  | { ok: true; status?: number; data: T }
  | { ok: false; status: number; error: { code: WebhookErrorCode; message: string } };

export async function handleCreateWebhook(
  input: CreateWebhookInput,
  auditContext: WebhookAuditContext = { actorType: 'capability_url' }
): Promise<HandlerResult<CreateWebhookData>> {
  const urlValidation = validateWebhookUrl(input.url);
  if (!urlValidation.ok) {
    return { ok: false, status: 400, error: urlValidation.error };
  }

  const webhookId = generateWebhookId();
  const secret = input.secret ?? generateWebhookSecret();
  const now = new Date().toISOString();

  await db.insert(webhooks).values({
    id: webhookId,
    workspaceId: input.workspaceId,
    url: input.url,
    events: JSON.stringify(input.events),
    scopeType: 'workspace',
    scopePath: null,
    secretHash: secret,
    createdAt: now,
    failureCount: 0,
  });

  logAction({
    workspaceId: input.workspaceId,
    action: 'webhook.create',
    resourceType: 'webhook',
    resourceId: webhookId,
    actorType: auditContext.actorType,
    actor: auditContext.actor,
    metadata: { url: input.url, events: input.events },
  });

  return {
    ok: true,
    status: 201,
    data: {
      id: webhookId,
      url: input.url,
      events: input.events,
      secret,
      createdAt: now,
      status: 'active',
      webUrl: `${APP_URL}/control/${input.workspaceId}/webhooks`,
    },
  };
}

export async function handleListWebhooks(workspaceId: string): Promise<HandlerResult<WebhookListData>> {
  const dbWebhooks = await db.query.webhooks.findMany({
    where: and(eq(webhooks.workspaceId, workspaceId), isNull(webhooks.deletedAt)),
  });

  const items = dbWebhooks.map((wh) => ({
    id: wh.id,
    url: wh.url,
    events: JSON.parse(wh.events) as WebhookEvent[],
    createdAt: wh.createdAt,
    failureCount: wh.failureCount ?? 0,
    status: (wh.disabledAt ? 'paused' : 'active') as 'active' | 'paused',
  }));

  return { ok: true, data: items };
}

export async function handleDeleteWebhook(
  input: DeleteWebhookInput,
  auditContext: WebhookAuditContext = { actorType: 'capability_url' }
): Promise<HandlerResult<WebhookDeleteData>> {
  const webhook = await db.query.webhooks.findFirst({
    where: and(
      eq(webhooks.id, input.webhookId),
      eq(webhooks.workspaceId, input.workspaceId),
      isNull(webhooks.deletedAt)
    ),
  });

  if (!webhook) {
    return {
      ok: false,
      status: 404,
      error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
    };
  }

  const now = new Date().toISOString();
  await db.update(webhooks).set({ deletedAt: now }).where(eq(webhooks.id, input.webhookId));

  logAction({
    workspaceId: input.workspaceId,
    action: 'webhook.delete',
    resourceType: 'webhook',
    resourceId: input.webhookId,
    actorType: auditContext.actorType,
    actor: auditContext.actor,
  });

  return { ok: true, data: { id: input.webhookId, deleted: true } };
}

export async function handleUpdateWebhook(
  input: UpdateWebhookInput,
  auditContext: WebhookAuditContext = { actorType: 'capability_url' }
): Promise<HandlerResult<WebhookUpdateData>> {
  const webhook = await db.query.webhooks.findFirst({
    where: and(
      eq(webhooks.id, input.webhookId),
      eq(webhooks.workspaceId, input.workspaceId),
      isNull(webhooks.deletedAt)
    ),
  });

  if (!webhook) {
    return {
      ok: false,
      status: 404,
      error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
    };
  }

  if (input.url) {
    const urlValidation = validateWebhookUrl(input.url);
    if (!urlValidation.ok) {
      return { ok: false, status: 400, error: urlValidation.error };
    }
  }

  const updates: Record<string, unknown> = {};
  if (input.url !== undefined) updates.url = input.url;
  if (input.events !== undefined) updates.events = JSON.stringify(input.events);
  if (input.active !== undefined) updates.disabledAt = input.active ? null : new Date().toISOString();
  if (input.secret !== undefined) updates.secretHash = input.secret;

  if (Object.keys(updates).length > 0) {
    await db.update(webhooks).set(updates).where(eq(webhooks.id, input.webhookId));
  }

  const updated = await db.query.webhooks.findFirst({ where: eq(webhooks.id, input.webhookId) });

  logAction({
    workspaceId: input.workspaceId,
    action: 'webhook.update',
    resourceType: 'webhook',
    resourceId: input.webhookId,
    actorType: auditContext.actorType,
    actor: auditContext.actor,
    metadata: { updates: Object.keys(updates) },
  });

  return {
    ok: true,
    data: {
      id: updated!.id,
      url: updated!.url,
      events: JSON.parse(updated!.events) as WebhookEvent[],
      status: updated!.disabledAt ? 'paused' : 'active',
      createdAt: updated!.createdAt,
      failureCount: updated!.failureCount ?? 0,
      ...(updated!.lastTriggeredAt && { lastTriggeredAt: updated!.lastTriggeredAt }),
    },
  };
}

export async function handleTestWebhook(input: TestWebhookInput): Promise<HandlerResult<WebhookTestData>> {
  const webhook = await db.query.webhooks.findFirst({
    where: and(
      eq(webhooks.id, input.webhookId),
      eq(webhooks.workspaceId, input.workspaceId),
      isNull(webhooks.deletedAt)
    ),
  });

  if (!webhook) {
    return {
      ok: false,
      status: 404,
      error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
    };
  }

  const testEvent = input.event || 'append.created';
  const payload = {
    event: testEvent,
    timestamp: new Date().toISOString(),
    data: { test: true },
  };

  const secret = webhook.secretHash ?? '';
  const result = await deliverWebhook({
    url: webhook.url,
    payload,
    webhookId: input.webhookId,
    secret,
  });

  if (result.delivered) {
    await db.update(webhooks)
      .set({ failureCount: 0, disabledAt: null, lastTriggeredAt: new Date().toISOString() })
      .where(eq(webhooks.id, input.webhookId));
  } else {
    const newFailureCount = (webhook.failureCount ?? 0) + 1;
    const updates: { failureCount: number; disabledAt?: string; lastTriggeredAt: string } = {
      failureCount: newFailureCount,
      lastTriggeredAt: new Date().toISOString(),
    };
    if (newFailureCount >= 5) {
      updates.disabledAt = new Date().toISOString();
    }
    await db.update(webhooks).set(updates).where(eq(webhooks.id, input.webhookId));
  }

  return {
    ok: true,
    data: {
      delivered: result.delivered,
      responseCode: result.responseCode,
      durationMs: result.durationMs,
      error: result.error,
    },
  };
}

type WebhookLogStatus = 'ok' | 'failed' | 'timeout' | 'error';

export async function handleGetLogs(input: GetLogsInput): Promise<HandlerResult<WebhookLogsData>> {
  const webhook = await db.query.webhooks.findFirst({
    where: and(eq(webhooks.id, input.webhookId), isNull(webhooks.deletedAt)),
  });

  if (!webhook) {
    return {
      ok: false,
      status: 404,
      error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
    };
  }

  if (webhook.workspaceId !== input.workspaceId) {
    return {
      ok: false,
      status: 404,
      error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
    };
  }

  const conditions = [eq(webhookDeliveries.webhookId, input.webhookId)];
  if (input.since) {
    conditions.push(gt(webhookDeliveries.createdAt, input.since));
  }

  const logs = await db.query.webhookDeliveries.findMany({
    where: and(...conditions),
    orderBy: [desc(webhookDeliveries.createdAt)],
    limit: input.limit,
  });

  const logEntries = logs.map((log) => ({
    id: log.id,
    event: log.event as WebhookEvent,
    status: log.status as WebhookLogStatus,
    responseCode: log.responseCode ?? undefined,
    timestamp: log.createdAt,
    durationMs: log.durationMs ?? undefined,
    error: log.error ?? undefined,
  }));

  return { ok: true, data: { logs: logEntries } };
}

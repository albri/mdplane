/**
 * Webhook Test Fixtures
 *
 * Factory functions for creating test webhooks directly in database.
 * Uses '__int_' prefix for easy identification and cleanup.
 */

import { db } from '../../db';
import { webhooks } from '../../db/schema';
import { generateKey, hashKey } from '../../core/capability-keys';
import { CONFIG } from '../config';

/**
 * Represents a created webhook.
 */
export interface TestWebhook {
  /** Webhook identifier */
  id: string;
  /** Workspace ID */
  workspaceId: string;
  /** Scope type */
  scopeType: string;
  /** Scope path */
  scopePath: string | null;
  /** Webhook URL */
  url: string;
  /** Events to trigger (JSON array) */
  events: string[];
  /** Whether webhook is recursive for folder scope */
  recursive: boolean;
  /** Secret (if any) */
  secret: string;
}

/**
 * Options for creating a webhook.
 */
export interface CreateWebhookOptions {
  /** Workspace ID */
  workspaceId: string;
  /** Webhook URL */
  url: string;
  /** Events to trigger (e.g., ['file.created', 'append.added']) */
  events: string[];
  /** Scope type (default: 'workspace') */
  scopeType?: 'workspace' | 'folder' | 'file';
  /** Scope path (default: '/') */
  scopePath?: string;
  /** Whether webhook is recursive for folder scope (default: true) */
  recursive?: boolean;
  /** Webhook secret */
  secret?: string;
}

/**
 * Create a test webhook directly in database.
 *
 * @param options - Webhook configuration options
 * @returns The webhook entity with secret
 */
export async function createTestWebhook(
  options: CreateWebhookOptions
): Promise<TestWebhook> {
  const webhookId = `${CONFIG.TEST_PREFIX}wh_${generateKey(12)}`;
  const secret = options.secret ?? `int_webhook_secret_${generateKey(16)}`;
  const now = new Date().toISOString();

  const webhook = await db.insert(webhooks).values({
    id: webhookId,
    workspaceId: options.workspaceId,
    scopeType: options.scopeType ?? 'workspace',
    scopePath: options.scopePath ?? '/',
    url: options.url,
    events: JSON.stringify(options.events),
    secretHash: secret ? hashKey(secret) : null,
    recursive: options.recursive !== false ? 1 : 0,
    createdAt: now,
    lastTriggeredAt: null,
    failureCount: 0,
    disabledAt: null,
    deletedAt: null,
  }).returning();

  console.log(`[FIXTURE] Created webhook: ${webhookId}`);

  return {
    id: webhook[0].id,
    workspaceId: webhook[0].workspaceId,
    scopeType: webhook[0].scopeType,
    scopePath: webhook[0].scopePath,
    url: webhook[0].url,
    events: options.events,
    recursive: webhook[0].recursive === 1,
    secret,
  };
}

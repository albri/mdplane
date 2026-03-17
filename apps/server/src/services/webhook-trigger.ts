/**
 * Webhook Trigger Service
 *
 * Provides functionality to trigger webhooks for system events.
 * Delivers webhook payloads to registered URLs asynchronously.
 *
 * @module services/webhook-trigger
 */

import { eq, and, isNull } from 'drizzle-orm';
import { db, sqlite } from '../db';
import { webhooks, webhookDeliveries } from '../db/schema';
import { validateWebhookUrl } from '../core/ssrf';
import { isPathInScope } from './webhook-scope';
import { generateKey } from '../core/capability-keys';

/**
 * Valid webhook event types from OpenAPI spec.
 */
export type WebhookEventType =
  | 'append'
  | 'append.created'
  | 'task.created'
  | 'task.claimed'
  | 'task.completed'
  | 'task.cancelled'
  | 'task.blocked'
  | 'task.unblocked'
  | 'task.overdue'
  | 'task.escalated'
  | 'task.recurred'
  | 'task.expired'
  | 'claim.created'
  | 'claim.expired'
  | 'claim.renewed'
  | 'claim.released'
  | 'file.created'
  | 'file.updated'
  | 'file.deleted'
  | 'heartbeat'
  | 'webhook.failed'
  | 'settings.changed'
  | 'workspace.claimed';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  webhookId: string;
  delivered: boolean;
  responseCode?: number;
  durationMs: number;
  error?: string;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 */
async function generateSignature(
  payload: string,
  secret: string,
  timestamp: number
): Promise<string> {
  const signaturePayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signaturePayload));
  const hexSignature = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hexSignature}`;
}

/**
 * Deliver webhook payload to URL.
 */
async function deliverWebhookPayload(
  url: string,
  payload: WebhookPayload,
  webhookId: string,
  secret: string
): Promise<WebhookDeliveryResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadJson = JSON.stringify(payload);

  // SSRF Protection: Validate URL before making request
  // This check happens on every delivery attempt (including retries)
  const urlValidation = await validateWebhookUrl(url);
  if (!urlValidation.safe) {
    return {
      webhookId,
      delivered: false,
      durationMs: 0,
      error: `SSRF protection: ${urlValidation.reason}`,
    };
  }

  try {
    const signature = await generateSignature(payloadJson, secret, timestamp);

    const startTime = performance.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Id': webhookId,
        'X-MP-Timestamp': timestamp.toString(),
        'X-MP-Signature': signature,
      },
      body: payloadJson,
    });
    const durationMs = Math.round(performance.now() - startTime);

    const delivered = response.status >= 200 && response.status < 300;
    return {
      webhookId,
      delivered,
      responseCode: response.status,
      durationMs,
    };
  } catch (error) {
    return {
      webhookId,
      delivered: false,
      durationMs: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Trigger webhooks for an event in a workspace.
 *
 * Finds all active webhooks that subscribe to the given event type and
 * delivers the payload asynchronously (fire-and-forget).
 *
 * @param workspaceId - The workspace ID where the event occurred
 * @param event - The event type (e.g., 'file.created', 'append.created')
 * @param data - The event payload data
 * @param filePath - Optional file path for scope filtering
 */
export async function triggerWebhooks(
  workspaceId: string,
  event: WebhookEventType,
  data: Record<string, unknown>,
  filePath?: string
): Promise<void> {
  // Find all active webhooks for this workspace
  const workspaceWebhooks = await db.query.webhooks.findMany({
    where: and(
      eq(webhooks.workspaceId, workspaceId),
      isNull(webhooks.deletedAt),
      isNull(webhooks.disabledAt)
    ),
  });

  if (workspaceWebhooks.length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();
  const payload: WebhookPayload = {
    event,
    timestamp,
    data,
  };

  // Deliver to each matching webhook asynchronously
  for (const webhook of workspaceWebhooks) {
    try {
      // Parse the events array from JSON
      const subscribedEvents = JSON.parse(webhook.events) as string[];

      // Check if this webhook subscribes to this event
      // Match exact event or wildcard '*' or category match (e.g., 'file' matches 'file.created')
      const eventCategory = event.split('.')[0];
      const matches = subscribedEvents.some(
        (e) => e === event || e === '*' || e === eventCategory
      );

      if (!matches) {
        continue;
      }

      // Check scope if file path is provided
      // webhook.recursive: 1=true (match nested), 0=false (direct children only), null=default true
      const isRecursive = webhook.recursive !== 0;
      if (filePath && !isPathInScope(filePath, webhook.scopeType, webhook.scopePath, isRecursive)) {
        continue;
      }

      // Deliver webhook asynchronously (fire-and-forget)
      const secret = webhook.secretHash ?? '';
      deliverWebhookPayload(webhook.url, payload, webhook.id, secret)
        .then(async (result) => {
          // Update webhook stats based on delivery result
          const now = new Date().toISOString();

          // Record delivery attempt in webhook_deliveries table
          const deliveryId = `whdel_${generateKey(12)}`;
          const deliveryStatus = result.delivered
            ? 'ok'
            : result.error?.includes('timeout')
              ? 'timeout'
              : result.error?.includes('SSRF')
                ? 'error'
                : 'failed';

          await db.insert(webhookDeliveries).values({
            id: deliveryId,
            webhookId: webhook.id,
            event,
            status: deliveryStatus,
            responseCode: result.responseCode ?? null,
            durationMs: result.durationMs,
            error: result.error ?? null,
            createdAt: now,
          });

          if (result.delivered) {
            // Reset failure count on success
            await db
              .update(webhooks)
              .set({
                failureCount: 0,
                lastTriggeredAt: now,
              })
              .where(eq(webhooks.id, webhook.id));
          } else {
            // Increment failure count
            const newFailureCount = (webhook.failureCount ?? 0) + 1;
            const updates: {
              failureCount: number;
              lastTriggeredAt: string;
              disabledAt?: string;
            } = {
              failureCount: newFailureCount,
              lastTriggeredAt: now,
            };

            // Disable webhook after 5 consecutive failures
            if (newFailureCount >= 5) {
              updates.disabledAt = now;
              console.warn(
                `Webhook ${webhook.id} disabled after ${newFailureCount} consecutive failures`
              );
            }

            await db
              .update(webhooks)
              .set(updates)
              .where(eq(webhooks.id, webhook.id));
          }
        })
        .catch((err) => {
          console.error(`Webhook delivery failed for ${webhook.id}:`, err);
        });
    } catch (err) {
      console.error(`Error processing webhook ${webhook.id}:`, err);
    }
  }
}


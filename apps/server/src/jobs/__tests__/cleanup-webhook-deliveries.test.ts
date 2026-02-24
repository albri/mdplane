import { describe, test, expect, beforeEach } from 'bun:test';
import { cleanupWebhookDeliveries } from '../cleanup-webhook-deliveries';
import { db } from '../../db';
import { webhookDeliveries, webhooks, workspaces } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('cleanupWebhookDeliveries', () => {
  const testWorkspaceId = 'test-ws-webhook-cleanup';
  const testWebhookId = 'test-wh-cleanup';
  const now = new Date();

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, testWebhookId));
    await db.delete(webhooks).where(eq(webhooks.id, testWebhookId));
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));

    // Create test workspace
    await db.insert(workspaces).values({
      id: testWorkspaceId,
      name: 'Test Webhook Cleanup Workspace',
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
    });

    // Create test webhook
    await db.insert(webhooks).values({
      id: testWebhookId,
      workspaceId: testWorkspaceId,
      scopeType: 'workspace',
      scopePath: '/',
      url: 'https://example.com/webhook',
      events: JSON.stringify(['file.created']),
      createdAt: now.toISOString(),
    });
  });

  test('should purge deliveries older than 7 days', async () => {
    // Create delivery 8 days ago
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const deliveryId = 'whdel_old_test';

    await db.insert(webhookDeliveries).values({
      id: deliveryId,
      webhookId: testWebhookId,
      event: 'file.created',
      status: 'ok',
      responseCode: 200,
      durationMs: 100,
      createdAt: eightDaysAgo,
    });

    // Run cleanup
    await cleanupWebhookDeliveries();

    // Verify delivery is gone
    const result = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, deliveryId),
    });
    expect(result).toBeUndefined();
  });

  test('should NOT purge deliveries less than 7 days old', async () => {
    // Create delivery 3 days ago
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const deliveryId = 'whdel_recent_test';

    await db.insert(webhookDeliveries).values({
      id: deliveryId,
      webhookId: testWebhookId,
      event: 'file.created',
      status: 'ok',
      responseCode: 200,
      durationMs: 100,
      createdAt: threeDaysAgo,
    });

    // Run cleanup
    await cleanupWebhookDeliveries();

    // Verify delivery still exists
    const result = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, deliveryId),
    });
    expect(result).toBeDefined();
  });

  test('should purge multiple old deliveries in one run', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    // Create multiple old deliveries
    await db.insert(webhookDeliveries).values([
      {
        id: 'whdel_old_1',
        webhookId: testWebhookId,
        event: 'file.created',
        status: 'ok',
        responseCode: 200,
        durationMs: 100,
        createdAt: eightDaysAgo,
      },
      {
        id: 'whdel_old_2',
        webhookId: testWebhookId,
        event: 'file.updated',
        status: 'failed',
        responseCode: 500,
        durationMs: 2000,
        error: 'Server error',
        createdAt: tenDaysAgo,
      },
    ]);

    // Run cleanup
    await cleanupWebhookDeliveries();

    // Verify both deliveries are gone
    const result1 = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, 'whdel_old_1'),
    });
    const result2 = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, 'whdel_old_2'),
    });

    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
  });

  test('should keep recent deliveries while purging old ones', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(webhookDeliveries).values([
      {
        id: 'whdel_old_mixed',
        webhookId: testWebhookId,
        event: 'file.created',
        status: 'ok',
        responseCode: 200,
        durationMs: 100,
        createdAt: eightDaysAgo,
      },
      {
        id: 'whdel_recent_mixed',
        webhookId: testWebhookId,
        event: 'file.updated',
        status: 'ok',
        responseCode: 200,
        durationMs: 150,
        createdAt: oneDayAgo,
      },
    ]);

    // Run cleanup
    await cleanupWebhookDeliveries();

    // Verify old is gone, recent remains
    const oldResult = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, 'whdel_old_mixed'),
    });
    const recentResult = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, 'whdel_recent_mixed'),
    });

    expect(oldResult).toBeUndefined();
    expect(recentResult).toBeDefined();
  });
});


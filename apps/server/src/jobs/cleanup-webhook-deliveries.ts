import { db } from '../db';
import { webhookDeliveries } from '../db/schema';
import { lt } from 'drizzle-orm';

const RETENTION_DAYS = 7;

export async function cleanupWebhookDeliveries(): Promise<void> {
  const threshold = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const result = await db.delete(webhookDeliveries).where(
    lt(webhookDeliveries.createdAt, threshold)
  );

  console.log(`[cleanupWebhookDeliveries] Purged delivery logs with createdAt < ${threshold}`);
}


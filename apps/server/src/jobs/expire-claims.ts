import { db, sqlite } from '../db';
import { appends, files } from '../db/schema';
import { and, eq, lt } from 'drizzle-orm';
import { emit } from '../services/event-bus';
import { triggerWebhooks } from '../services/webhook-trigger';

export async function expireClaims(): Promise<void> {
  const now = new Date().toISOString();

  const expiredClaims = await db.query.appends.findMany({
    where: and(
      eq(appends.type, 'claim'),
      eq(appends.status, 'active'),
      lt(appends.expiresAt, now)
    ),
  });

  if (expiredClaims.length === 0) {
    return;
  }

  console.log(`[expireClaims] Found ${expiredClaims.length} expired claims`);

  for (const claim of expiredClaims) {
    await db.update(appends)
      .set({ status: 'expired' })
      .where(eq(appends.id, claim.id));

    if (claim.ref) {
      await db.update(appends)
        .set({ status: 'open' })
        .where(and(
          eq(appends.fileId, claim.fileId),
          eq(appends.appendId, claim.ref),
          eq(appends.type, 'task')
        ));
    }

    const file = await db.query.files.findFirst({
      where: eq(files.id, claim.fileId),
    });

    if (file) {
      const eventData = {
        claimId: claim.appendId,
        taskId: claim.ref,
        author: claim.author,
        expiredAt: now,
      };

      emit({
        type: 'claim.expired',
        workspaceId: file.workspaceId,
        filePath: file.path,
        data: eventData,
        timestamp: now,
      });

      await triggerWebhooks(file.workspaceId, 'claim.expired', eventData, file.path);
    }
  }

  console.log(`[expireClaims] Expired ${expiredClaims.length} claims`);
}


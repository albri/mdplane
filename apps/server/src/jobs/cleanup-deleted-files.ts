import { db } from '../db';
import { files } from '../db/schema';
import { and, isNotNull, lt } from 'drizzle-orm';

const RETENTION_DAYS = 7;

export async function cleanupDeletedFiles(): Promise<void> {
  const threshold = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.delete(files).where(
    and(
      isNotNull(files.deletedAt),
      lt(files.deletedAt, threshold)
    )
  );

  console.log(`[cleanupDeletedFiles] Purged files with deletedAt < ${threshold}`);
}


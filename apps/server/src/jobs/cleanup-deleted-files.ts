import { db } from '../db';
import { files } from '../db/schema';
import { and, isNotNull, lt } from 'drizzle-orm';

const RETENTION_DAYS = 7;

type CleanupDeletedFilesDb = Pick<typeof db, 'delete'>;

export async function cleanupDeletedFiles(database: CleanupDeletedFilesDb = db): Promise<void> {
  const threshold = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await database.delete(files).where(
    and(
      isNotNull(files.deletedAt),
      lt(files.deletedAt, threshold)
    )
  );

  console.log(`[cleanupDeletedFiles] Purged files with deletedAt < ${threshold}`);
}

import { eq, inArray } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { DEMO_READ_KEY, DEMO_WORKSPACE_ID, DEMO_WORKSPACE_NAME } from '@mdplane/shared';
import { generateKey, hashKey } from '../core/capability-keys';
import * as schema from './schema';
import { buildDemoAppends } from './demo/appends';
import { DEMO_FILES } from './demo/files';

export async function seedDemoWorkspace(db: BunSQLiteDatabase<typeof schema>): Promise<void> {
  const existingWorkspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, DEMO_WORKSPACE_ID),
  });

  console.log(existingWorkspace ? '[seed-demo] Reseeding demo workspace content...' : '[seed-demo] Creating demo workspace...');

  await db.transaction(async (tx) => {
    const now = new Date().toISOString();
    const existingFiles = await tx
      .select({ id: schema.files.id })
      .from(schema.files)
      .where(eq(schema.files.workspaceId, DEMO_WORKSPACE_ID));

    if (existingFiles.length > 0) {
      const existingFileIds = existingFiles.map((file) => file.id);
      await tx.delete(schema.appends).where(inArray(schema.appends.fileId, existingFileIds));
      await tx.delete(schema.appendCounters).where(inArray(schema.appendCounters.fileId, existingFileIds));
      await tx.delete(schema.files).where(eq(schema.files.workspaceId, DEMO_WORKSPACE_ID));
    }

    await tx.delete(schema.folders).where(eq(schema.folders.workspaceId, DEMO_WORKSPACE_ID));
    await tx.delete(schema.capabilityKeys).where(eq(schema.capabilityKeys.workspaceId, DEMO_WORKSPACE_ID));

    if (existingWorkspace) {
      await tx
        .update(schema.workspaces)
        .set({
          name: DEMO_WORKSPACE_NAME,
          claimedAt: null,
          claimedByEmail: null,
          deletedAt: null,
          lastActivityAt: now,
          storageUsedBytes: 0,
        })
        .where(eq(schema.workspaces.id, DEMO_WORKSPACE_ID));
    } else {
      await tx.insert(schema.workspaces).values({
        id: DEMO_WORKSPACE_ID,
        name: DEMO_WORKSPACE_NAME,
        createdAt: now,
        lastActivityAt: now,
        storageUsedBytes: 0,
      });
    }

    await tx.insert(schema.capabilityKeys).values({
      id: generateKey(16),
      workspaceId: DEMO_WORKSPACE_ID,
      prefix: DEMO_READ_KEY.substring(0, 4),
      keyHash: hashKey(DEMO_READ_KEY),
      permission: 'read',
      scopeType: 'workspace',
      scopePath: '/',
      createdAt: now,
    });

    const fileIds: Record<string, string> = {};
    for (const file of DEMO_FILES) {
      const fileId = generateKey(16);
      fileIds[file.path] = fileId;
      await tx.insert(schema.files).values({
        id: fileId,
        workspaceId: DEMO_WORKSPACE_ID,
        path: file.path,
        content: file.content,
        createdAt: now,
        updatedAt: now,
      });
    }

    const sampleAppends = buildDemoAppends();

    for (const append of sampleAppends) {
      const fileId = fileIds[append.filePath];
      if (!fileId) continue;

      await tx.insert(schema.appends).values({
        id: generateKey(16),
        fileId,
        appendId: append.appendId,
        author: append.author,
        type: append.type,
        ref: append.ref,
        status: append.status,
        priority: append.priority,
        expiresAt: append.expiresAt,
        contentPreview: append.contentPreview,
        createdAt: append.createdAt,
      });
    }

    console.log(`[seed-demo] Demo workspace created with ${DEMO_FILES.length} files and ${sampleAppends.length} appends`);
  });
}


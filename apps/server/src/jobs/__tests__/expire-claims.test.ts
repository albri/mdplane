import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { expireClaims } from '../expire-claims';
import { db } from '../../db';
import { files, workspaces, appends } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { subscribe, clearAllListeners, type BusEvent } from '../../services/event-bus';

describe('expireClaims', () => {
  const testWorkspaceId = 'test-ws-expire-claims';
  const testFileId = 'file-expire-claims-test';
  const now = new Date();

  beforeEach(async () => {
    // Clear event listeners
    clearAllListeners();

    // Clean up any existing test data
    await db.delete(appends).where(eq(appends.fileId, testFileId));
    await db.delete(files).where(eq(files.id, testFileId));
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));

    // Create test workspace
    await db.insert(workspaces).values({
      id: testWorkspaceId,
      name: 'Test Expire Claims Workspace',
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
    });

    // Create test file
    await db.insert(files).values({
      id: testFileId,
      workspaceId: testWorkspaceId,
      path: '/expire-claims-test.md',
      content: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });

  test('should expire claims with past expiresAt', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago

    // Create a task
    await db.insert(appends).values({
      id: `${testFileId}_a1`,
      fileId: testFileId,
      appendId: 'a1',
      author: 'test-author',
      type: 'task',
      status: 'claimed',
      createdAt: now.toISOString(),
    });

    // Create an expired claim on the task
    await db.insert(appends).values({
      id: `${testFileId}_a2`,
      fileId: testFileId,
      appendId: 'a2',
      author: 'agent-1',
      type: 'claim',
      ref: 'a1',
      status: 'active',
      expiresAt: pastDate,
      createdAt: now.toISOString(),
    });

    // Run the job
    await expireClaims();

    // Verify claim is expired
    const claim = await db.query.appends.findFirst({
      where: eq(appends.id, `${testFileId}_a2`),
    });
    expect(claim?.status).toBe('expired');
  });

  test('should reopen the referenced task when claim expires', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString();

    // Create a claimed task
    await db.insert(appends).values({
      id: `${testFileId}_a1`,
      fileId: testFileId,
      appendId: 'a1',
      author: 'test-author',
      type: 'task',
      status: 'claimed',
      createdAt: now.toISOString(),
    });

    // Create an expired claim on the task
    await db.insert(appends).values({
      id: `${testFileId}_a2`,
      fileId: testFileId,
      appendId: 'a2',
      author: 'agent-1',
      type: 'claim',
      ref: 'a1',
      status: 'active',
      expiresAt: pastDate,
      createdAt: now.toISOString(),
    });

    // Run the job
    await expireClaims();

    // Verify task is reopened
    const task = await db.query.appends.findFirst({
      where: eq(appends.id, `${testFileId}_a1`),
    });
    expect(task?.status).toBe('open');
  });

  test('should emit claim.expired event', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString();
    const receivedEvents: BusEvent[] = [];

    // Subscribe to events
    subscribe(testWorkspaceId, (event) => receivedEvents.push(event));

    // Create a task
    await db.insert(appends).values({
      id: `${testFileId}_a1`,
      fileId: testFileId,
      appendId: 'a1',
      author: 'test-author',
      type: 'task',
      status: 'claimed',
      createdAt: now.toISOString(),
    });

    // Create an expired claim
    await db.insert(appends).values({
      id: `${testFileId}_a2`,
      fileId: testFileId,
      appendId: 'a2',
      author: 'agent-1',
      type: 'claim',
      ref: 'a1',
      status: 'active',
      expiresAt: pastDate,
      createdAt: now.toISOString(),
    });

    // Run the job
    await expireClaims();

    // Verify event was emitted
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('claim.expired');
    expect(receivedEvents[0].filePath).toBe('/expire-claims-test.md');
    expect(receivedEvents[0].data.claimId).toBe('a2');
    expect(receivedEvents[0].data.taskId).toBe('a1');
    expect(receivedEvents[0].data.author).toBe('agent-1');
  });

  test('should be idempotent (re-running does not re-expire)', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString();
    const receivedEvents: BusEvent[] = [];

    // Subscribe to events
    subscribe(testWorkspaceId, (event) => receivedEvents.push(event));

    // Create a task
    await db.insert(appends).values({
      id: `${testFileId}_a1`,
      fileId: testFileId,
      appendId: 'a1',
      author: 'test-author',
      type: 'task',
      status: 'claimed',
      createdAt: now.toISOString(),
    });

    // Create an expired claim
    await db.insert(appends).values({
      id: `${testFileId}_a2`,
      fileId: testFileId,
      appendId: 'a2',
      author: 'agent-1',
      type: 'claim',
      ref: 'a1',
      status: 'active',
      expiresAt: pastDate,
      createdAt: now.toISOString(),
    });

    // Run the job twice
    await expireClaims();
    await expireClaims();

    // Should only emit one event (idempotent)
    expect(receivedEvents).toHaveLength(1);
  });

  test('should NOT expire claims with future expiresAt', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

    // Create a task
    await db.insert(appends).values({
      id: `${testFileId}_a1`,
      fileId: testFileId,
      appendId: 'a1',
      author: 'test-author',
      type: 'task',
      status: 'claimed',
      createdAt: now.toISOString(),
    });

    // Create a non-expired claim
    await db.insert(appends).values({
      id: `${testFileId}_a2`,
      fileId: testFileId,
      appendId: 'a2',
      author: 'agent-1',
      type: 'claim',
      ref: 'a1',
      status: 'active',
      expiresAt: futureDate,
      createdAt: now.toISOString(),
    });

    // Run the job
    await expireClaims();

    // Verify claim is still active
    const claim = await db.query.appends.findFirst({
      where: eq(appends.id, `${testFileId}_a2`),
    });
    expect(claim?.status).toBe('active');

    // Verify task is still claimed
    const task = await db.query.appends.findFirst({
      where: eq(appends.id, `${testFileId}_a1`),
    });
    expect(task?.status).toBe('claimed');
  });

  test('should NOT expire already-expired claims', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString();
    const receivedEvents: BusEvent[] = [];

    subscribe(testWorkspaceId, (event) => receivedEvents.push(event));

    // Create an already-expired claim (status = 'expired')
    await db.insert(appends).values({
      id: `${testFileId}_a2`,
      fileId: testFileId,
      appendId: 'a2',
      author: 'agent-1',
      type: 'claim',
      ref: 'a1',
      status: 'expired',  // Already expired
      expiresAt: pastDate,
      createdAt: now.toISOString(),
    });

    // Run the job
    await expireClaims();

    // No events should be emitted
    expect(receivedEvents).toHaveLength(0);
  });
});


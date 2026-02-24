/**
 * Append Test Fixtures
 *
 * Factory functions for creating test appends and tasks directly in database.
 * Uses '__int_' prefix for easy identification and cleanup.
 */

import { db } from '../../db';
import { appends, files } from '../../db/schema';
import { generateKey } from '../../core/capability-keys';
import { CONFIG } from '../config';

/**
 * Represents a created append.
 */
export interface TestAppend {
  /** Append identifier */
  id: string;
  /** File ID */
  fileId: string;
  /** Append ID (e.g., 'a1', 'a2') */
  appendId: string;
  /** Author */
  author: string;
  /** Type (e.g., 'task', 'claim', 'response') */
  type: string | null;
  /** Reference ID */
  ref: string | null;
  /** Status */
  status: string | null;
  /** Priority */
  priority: string | null;
  /** Labels (comma-separated) */
  labels: string | null;
  /** Due date */
  dueAt: string | null;
  /** Expires date */
  expiresAt: string | null;
  /** Creation timestamp */
  createdAt: string;
  /** Content preview */
  contentPreview: string | null;
}

/**
 * Options for creating an append.
 */
export interface CreateAppendOptions {
  /** File ID */
  fileId: string;
  /** Append ID (e.g., 'a1', 'a2') */
  appendId?: string;
  /** Author */
  author: string;
  /** Type (e.g., 'task', 'claim', 'response', 'renew', 'cancel') */
  type?: string;
  /** Reference ID (for claims, responses) */
  ref?: string;
  /** Status */
  status?: 'pending' | 'open' | 'claimed' | 'completed' | 'done' | 'expired' | 'cancelled' | 'active';
  /** Priority */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Labels (array of strings) */
  labels?: string[];
  /** Due date (ISO string) */
  dueAt?: string | null;
  /** Expires date (ISO string) */
  expiresAt?: string | null;
  /** Content preview */
  contentPreview?: string | null;
}

/**
 * Create a test append directly in database.
 *
 * @param options - Append configuration options
 * @returns The append entity
 */
export async function createTestAppend(
  options: CreateAppendOptions
): Promise<TestAppend> {
  const appendId = options.appendId ?? `${CONFIG.TEST_PREFIX}a${generateKey(8)}`;
  const now = new Date().toISOString();

  const append = await db.insert(appends).values({
    id: `${CONFIG.TEST_PREFIX}app_${generateKey(12)}`,
    fileId: options.fileId,
    appendId,
    author: options.author,
    type: options.type ?? null,
    ref: options.ref ?? null,
    status: options.status ?? null,
    priority: options.priority ?? null,
    labels: options.labels ? options.labels.join(',') : null,
    dueAt: options.dueAt ?? null,
    expiresAt: options.expiresAt ?? null,
    createdAt: now,
    contentPreview: options.contentPreview ?? null,
    contentHash: null,
  }).returning();

  console.log(`[FIXTURE] Created append: ${append[0].appendId}`);

  return {
    id: append[0].id,
    fileId: append[0].fileId,
    appendId: append[0].appendId,
    author: append[0].author,
    type: append[0].type,
    ref: append[0].ref,
    status: append[0].status,
    priority: append[0].priority,
    labels: append[0].labels,
    dueAt: append[0].dueAt,
    expiresAt: append[0].expiresAt,
    createdAt: append[0].createdAt,
    contentPreview: append[0].contentPreview,
  };
}

/**
 * Represents a created task.
 */
export interface TestTask extends TestAppend {
  /** Task content (for reference) */
  content: string;
}

/**
 * Options for creating a task.
 */
export interface CreateTaskOptions extends Omit<CreateAppendOptions, 'type'> {
  /** Task content/description */
  content: string;
}

/**
 * Create a test task append directly in database.
 *
 * @param options - Task configuration options
 * @returns The task entity
 */
export async function createTestTask(
  options: CreateTaskOptions
): Promise<TestTask> {
  const contentPreview = options.content?.substring(0, 200) ?? 'Test task';
  
  const task = await createTestAppend({
    ...options,
    type: 'task',
    status: 'open',
    contentPreview,
  });

  return {
    ...task,
    content: options.content,
  };
}

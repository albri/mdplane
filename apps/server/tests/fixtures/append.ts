/**
 * Append Test Fixtures
 *
 * Factory functions for creating tasks, claims, and completions in tests.
 *
 * @example
 * ```typescript
 * const task = await createTestTask(app, workspace, file, {
 *   author: 'agent-1',
 *   content: 'Implement feature X',
 * });
 * const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-1');
 * ```
 */

import type { Elysia } from 'elysia';
import type { TestWorkspace } from './workspace';
import type { TestFile } from './file';

/**
 * Represents a created task append.
 */
export interface TestTask {
  /** Unique append ID (format: a[number]) */
  appendId: string;
  /** Reference ID for targeting this task (same as appendId) */
  ref: string;
  /** Author who created the task */
  author: string;
  /** Task content/description */
  content: string;
}

/**
 * Options for creating a test task.
 */
export interface CreateTaskOptions {
  /** Author identifier (e.g., 'agent-1', 'user@example.com') */
  author: string;
  /** Task content/description */
  content: string;
  /** Optional priority (e.g., 'high', 'medium', 'low') */
  priority?: string;
  /** Optional labels for categorization */
  labels?: string[];
}

/**
 * Create a task append on a file.
 *
 * @param app - Elysia application instance
 * @param workspace - Test workspace containing capability keys
 * @param file - Target file for the task
 * @param options - Task creation options
 * @returns Promise resolving to the created task
 * @throws Error if task creation fails
 */
export async function createTestTask(
  app: Elysia,
  workspace: TestWorkspace,
  file: TestFile,
  options: CreateTaskOptions
): Promise<TestTask> {
  const response = await app.handle(
    new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'task',
        author: options.author,
        content: options.content,
        priority: options.priority,
        labels: options.labels,
      }),
    })
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create task: ${JSON.stringify(error)}`);
  }

  const { data } = await response.json();

  return {
    appendId: data.id,
    ref: data.id,
    author: data.author,
    content: options.content,
  };
}

/**
 * Claim a task.
 *
 * Returns the raw response so tests can check status codes for both
 * success and failure cases (e.g., 409 CONFLICT when already claimed).
 *
 * @param app - Elysia application instance
 * @param workspace - Test workspace containing capability keys
 * @param file - Target file containing the task
 * @param ref - Reference to the task to claim (the task's appendId)
 * @param author - Author making the claim
 * @param expiresInSeconds - Optional custom expiry in seconds
 * @returns Promise resolving to the raw response
 */
export async function claimTask(
  app: Elysia,
  workspace: TestWorkspace,
  file: TestFile,
  ref: string,
  author: string,
  expiresInSeconds?: number
): Promise<Response> {
  const body: Record<string, unknown> = {
    type: 'claim',
    ref,
    author,
  };

  if (expiresInSeconds !== undefined) {
    body.expiresInSeconds = expiresInSeconds;
  }

  return app.handle(
    new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

/**
 * Complete a task.
 *
 * Returns the raw response so tests can check status codes.
 *
 * @param app - Elysia application instance
 * @param workspace - Test workspace containing capability keys
 * @param file - Target file containing the task
 * @param ref - Reference to the task to complete (the task's appendId)
 * @param author - Author completing the task
 * @param content - Completion content/summary
 * @returns Promise resolving to the raw response
 */
export async function completeTask(
  app: Elysia,
  workspace: TestWorkspace,
  file: TestFile,
  ref: string,
  author: string,
  content?: string
): Promise<Response> {
  return app.handle(
    new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'response',
        ref,
        author,
        content: content ?? 'Task completed',
      }),
    })
  );
}

/**
 * Renew (extend) a claim on a task.
 *
 * Returns the raw response so tests can check status codes.
 *
 * @param app - Elysia application instance
 * @param workspace - Test workspace containing capability keys
 * @param file - Target file containing the claim
 * @param ref - Reference to the claim to renew (the claim's appendId)
 * @param author - Author renewing the claim (must be claim holder)
 * @param expiresInSeconds - Optional new expiry in seconds
 * @returns Promise resolving to the raw response
 */
export async function renewClaim(
  app: Elysia,
  workspace: TestWorkspace,
  file: TestFile,
  ref: string,
  author: string,
  expiresInSeconds?: number
): Promise<Response> {
  const body: Record<string, unknown> = {
    type: 'renew',
    ref,
    author,
  };

  if (expiresInSeconds !== undefined) {
    body.expiresInSeconds = expiresInSeconds;
  }

  return app.handle(
    new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

/**
 * Cancel (abandon) a claim on a task.
 *
 * Returns the raw response so tests can check status codes.
 *
 * @param app - Elysia application instance
 * @param workspace - Test workspace containing capability keys
 * @param file - Target file containing the claim
 * @param ref - Reference to the claim to cancel (the claim's appendId)
 * @param author - Author cancelling the claim (must be claim holder)
 * @returns Promise resolving to the raw response
 */
export async function cancelClaim(
  app: Elysia,
  workspace: TestWorkspace,
  file: TestFile,
  ref: string,
  author: string
): Promise<Response> {
  return app.handle(
    new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'cancel',
        ref,
        author,
      }),
    })
  );
}


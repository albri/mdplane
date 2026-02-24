/**
 * File Test Fixtures
 *
 * Factory functions for creating and manipulating test files.
 *
 * @example
 * ```typescript
 * const app = createTestApp();
 * const workspace = await createTestWorkspace(app);
 * const file = await createTestFile(app, workspace, '/examples/sprint.md');
 * ```
 */

import type { Elysia } from 'elysia';
import type { TestWorkspace } from './workspace';

/**
 * Represents a created test file.
 */
export interface TestFile {
  /** Unique file identifier */
  id: string;
  /** File path within the workspace */
  path: string;
  /** File content */
  content: string;
  /** ETag for optimistic concurrency */
  etag: string;
}

/**
 * Default content for test files.
 */
export const DEFAULT_FILE_CONTENT = `# Test File

This is a test file for scenario testing.

## Tasks

Tasks will be appended here.
`;

/**
 * Create a test file in a workspace.
 *
 * @param app - Elysia application instance
 * @param workspace - Test workspace containing capability keys
 * @param path - File path (e.g., '/examples/sprint.md')
 * @param content - Optional file content (uses default if not provided)
 * @returns Promise resolving to the created file
 * @throws Error if file creation fails
 */
export async function createTestFile(
  app: Elysia,
  workspace: TestWorkspace,
  path: string,
  content: string = DEFAULT_FILE_CONTENT
): Promise<TestFile> {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const response = await app.handle(
    new Request(`http://localhost/w/${workspace.writeKey}${normalizedPath}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create file '${normalizedPath}': ${JSON.stringify(error)}`);
  }

  const { data } = await response.json();

  return {
    id: data.id,
    path: normalizedPath,
    content,
    etag: data.etag,
  };
}

/**
 * Read a test file from a workspace.
 *
 * @param app - Elysia application instance
 * @param workspace - Test workspace containing capability keys
 * @param path - File path to read
 * @returns Promise resolving to the file response
 */
export async function readTestFile(
  app: Elysia,
  workspace: TestWorkspace,
  path: string
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return app.handle(
    new Request(`http://localhost/r/${workspace.readKey}${normalizedPath}`, {
      method: 'GET',
    })
  );
}

/**
 * Update a test file in a workspace.
 *
 * @param app - Elysia application instance
 * @param workspace - Test workspace containing capability keys
 * @param path - File path to update
 * @param content - New file content
 * @param etag - Optional ETag for optimistic concurrency
 * @returns Promise resolving to the update response
 */
export async function updateTestFile(
  app: Elysia,
  workspace: TestWorkspace,
  path: string,
  content: string,
  etag?: string
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (etag) {
    headers['If-Match'] = etag;
  }

  return app.handle(
    new Request(`http://localhost/w/${workspace.writeKey}${normalizedPath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content }),
    })
  );
}

/**
 * Delete a test file from a workspace.
 *
 * @param app - Elysia application instance
 * @param workspace - Test workspace containing capability keys
 * @param path - File path to delete
 * @param permanent - Whether to permanently delete (default: false)
 * @returns Promise resolving to the delete response
 */
export async function deleteTestFile(
  app: Elysia,
  workspace: TestWorkspace,
  path: string,
  permanent: boolean = false
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const query = permanent ? '?permanent=true' : '';

  return app.handle(
    new Request(`http://localhost/w/${workspace.writeKey}${normalizedPath}${query}`, {
      method: 'DELETE',
    })
  );
}


/**
 * Workspace Test Fixtures
 *
 * Factory functions for creating test workspaces via the bootstrap endpoint.
 * Each test can create a fresh workspace to ensure isolation.
 *
 * @example
 * ```typescript
 * const app = createTestApp();
 * const workspace = await createTestWorkspace(app);
 * console.log(workspace.writeKey); // Use to create files
 * ```
 */

import type { Elysia } from 'elysia';

/**
 * Represents a bootstrapped test workspace with all capability keys.
 */
export interface TestWorkspace {
  /** Unique workspace identifier (format: ws_[base62]) */
  workspaceId: string;
  /** Key for read-only access */
  readKey: string;
  /** Key for append-only access (adding tasks, claims) */
  appendKey: string;
  /** Key for full write access (create, update, delete files) */
  writeKey: string;
}

/**
 * Bootstrap a fresh test workspace.
 *
 * Creates a new workspace via the /bootstrap endpoint and extracts
 * the capability keys from the response URLs.
 *
 * @param app - Elysia application instance
 * @param options - Optional workspace configuration
 * @returns Promise resolving to the created workspace with keys
 * @throws Error if bootstrap fails
 */
export async function createTestWorkspace(
  app: Elysia,
  options: { workspaceName?: string } = {}
): Promise<TestWorkspace> {
  const requestBody = {
    workspaceName: options.workspaceName ?? `test-workspace-${Date.now()}`,
  };

  const response = await app.handle(
    new Request('http://localhost/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to bootstrap workspace: ${response.status} - ${JSON.stringify(error)}`);
  }

  const { data } = await response.json();

  return {
    workspaceId: data.workspaceId,
    readKey: data.keys.read,
    appendKey: data.keys.append,
    writeKey: data.keys.write,
  };
}

/**
 * Extract the capability key from a capability URL.
 *
 * URLs are in the format: https://mdplane.dev/r/KEY/folders
 * or /r/KEY/folders
 *
 * @param url - Capability URL containing the key
 * @returns Extracted key string
 * @throws Error if URL format is invalid
 */
function extractKey(url: string): string {
  // URLs are like https://mdplane.dev/r/KEY/folders or /r/KEY/folders
  // Permission prefixes: r=read, a=append, w=write
  const match = url.match(/\/([raw])\/([A-Za-z0-9]+)/);
  if (!match) {
    throw new Error(`Invalid capability URL format: ${url}`);
  }
  return match[2];
}

/**
 * Cleanup test workspaces.
 * This is a no-op for now as workspaces are created fresh each test.
 * The database is reset between test runs.
 */
export function cleanupTestWorkspaces(): void {
  // No-op - workspaces don't need cleanup as database is fresh per test run
  // and we use unique workspace IDs each time
}


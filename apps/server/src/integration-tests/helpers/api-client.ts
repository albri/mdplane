/**
 * Integration Tests API Client
 *
 * Minimal HTTP client for hitting localhost:3001.
 */

import { CONFIG } from '../config';

interface RequestOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Make an API request to localhost:3001
 */
export async function apiRequest(
  method: string,
  path: string,
  options: RequestOptions = {}
): Promise<Response> {
  const url = `${CONFIG.TEST_API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const timeout = options.timeout ?? CONFIG.TIMEOUTS.REQUEST;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if API is reachable (fail-fast)
 */
export async function checkConnectivity(): Promise<void> {
  try {
    const response = await apiRequest('GET', '/health', {
      timeout: CONFIG.TIMEOUTS.CONNECTIVITY,
    });
    if (!response.ok) {
      throw new Error(`Health check returned ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot reach API at ${CONFIG.TEST_API_URL}: ${message}`);
  }
}

/** Bootstrapped workspace with extracted keys */
export interface BootstrappedWorkspace {
  workspaceId: string;
  readKey: string;
  appendKey: string;
  writeKey: string;
}

/**
 * Extract capability key from URL
 */
function extractKey(url: string, prefix: string): string {
  const match = url.match(new RegExp(`/${prefix}/([^/]+)`));
  if (!match) {
    throw new Error(`Could not extract ${prefix} key from URL: ${url}`);
  }
  return match[1]!;
}

/**
 * Bootstrap a new workspace for testing.
 */
export async function bootstrap(workspaceName?: string): Promise<BootstrappedWorkspace> {
  const name = workspaceName ?? `${CONFIG.TEST_PREFIX}${Date.now()}`;

  const response = await apiRequest('POST', '/bootstrap', {
    body: { workspaceName: name },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bootstrap failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  if (!data.ok || !data.data) {
    throw new Error(`Bootstrap response invalid: ${JSON.stringify(data)}`);
  }

  const { workspaceId, keys } = data.data;

  const workspace: BootstrappedWorkspace = {
    workspaceId,
    readKey: keys.read,
    appendKey: keys.append,
    writeKey: keys.write,
  };

  return workspace;
}

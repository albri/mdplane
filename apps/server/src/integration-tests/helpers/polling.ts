/**
 * Polling Helpers
 *
 * Replace flakey sleep() calls with proper polling that:
 * - Polls at regular intervals
 * - Has configurable timeout
 * - Includes debug info on timeout
 */

import { CONFIG } from '../config';

export interface PollingOptions {
  /** Polling interval in ms (default: 300) */
  intervalMs?: number;
  /** Total timeout in ms (default: 15000) */
  timeoutMs?: number;
  /** Description for error messages */
  description?: string;
}

/**
 * Generic polling helper that waits for a condition to be true.
 *
 * @param condition - Function that returns true when condition is met
 * @param options - Polling configuration
 * @returns Promise that resolves when condition is true
 * @throws Error with debug info if timeout is reached
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  options: PollingOptions = {}
): Promise<void> {
  const {
    intervalMs = 300,
    timeoutMs = 15000,
    description = 'condition',
  } = options;

  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timeout waiting for ${description} after ${timeoutMs}ms (${attempts} attempts). ` +
      `Started at: ${new Date(startTime).toISOString()}`
  );
}

/**
 * Wait for a webhook delivery to appear in receiver.
 *
 * @param receiverUrl - URL of the webhook receiver's list endpoint
 * @param filter - Function to match the expected webhook
 * @param options - Polling configuration
 * @returns The matched webhook payload
 */
export async function waitForWebhookDelivery<T = unknown>(
  receiverUrl: string,
  filter: (payload: T) => boolean,
  options: PollingOptions = {}
): Promise<T> {
  const { timeoutMs = CONFIG.TIMEOUTS.WEBHOOK_DELIVERY, intervalMs = 300, description = 'webhook delivery' } = options;
  const startTime = Date.now();
  let attempts = 0;
  let lastPayloads: T[] = [];

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    try {
      const response = await fetch(receiverUrl);
      if (response.ok) {
        const data = await response.json();
        lastPayloads = Array.isArray(data) ? data : data.webhooks || [];

        const match = lastPayloads.find(filter);
        if (match) {
          return match;
        }
      }
    } catch {
      // Ignore fetch errors, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timeout waiting for ${description} after ${timeoutMs}ms (${attempts} attempts). ` +
      `Last seen payloads: ${JSON.stringify(lastPayloads.slice(-3), null, 2)}`
  );
}

/**
 * Wait for a claim to expire by polling task status.
 *
 * @param readKey - Read key for workspace
 * @param filePath - Path to file containing task
 * @param taskRef - Reference ID of task
 * @param options - Polling configuration
 * @returns The task data when claim is expired
 */
export async function waitForClaimExpiry(
  readKey: string,
  filePath: string,
  taskRef: string,
  options: PollingOptions = {}
): Promise<{ claimedBy: string | null; claimedUntil: string | null }> {
  const { timeoutMs = CONFIG.TIMEOUTS.CLAIM_EXPIRY, intervalMs = 500, description = 'claim expiry' } = options;
  const startTime = Date.now();
  let attempts = 0;
  let lastStatus: { claimedBy: string | null; claimedUntil: string | null } | null = null;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    try {
      const response = await fetch(`${CONFIG.TEST_API_URL}/r/${readKey}${filePath}?format=json`);
      if (response.ok) {
        const data = await response.json();
        const task = data.data?.appends?.find(
          (a: { ref?: string; type?: string }) => a.ref === taskRef && a.type === 'task'
        );

        if (task) {
          lastStatus = {
            claimedBy: task.claimedBy || null,
            claimedUntil: task.claimedUntil || null,
          };

          if (!task.claimedBy || !task.claimedUntil) {
            return lastStatus;
          }

          const expiryTime = new Date(task.claimedUntil).getTime();
          if (expiryTime < Date.now()) {
            return lastStatus;
          }
        }
      }
    } catch {
      // Ignore fetch errors, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timeout waiting for ${description} after ${timeoutMs}ms (${attempts} attempts). ` +
      `Last status: ${JSON.stringify(lastStatus)}`
  );
}

/**
 * Wait for rate limit window to reset.
 *
 * @param endpoint - Endpoint to test
 * @param options - Polling configuration
 * @returns Promise that resolves when rate limit is reset
 */
export async function waitForRateLimitReset(
  endpoint: string,
  options: PollingOptions = {}
): Promise<void> {
  const { timeoutMs = 30000, intervalMs = 500, description = 'rate limit reset' } = options;
  const startTime = Date.now();
  let attempts = 0;
  let lastStatus = 0;
  let lastRetryAfter: string | null = null;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    try {
      const response = await fetch(`${CONFIG.TEST_API_URL}${endpoint}`);
      lastStatus = response.status;
      lastRetryAfter = response.headers.get('Retry-After');

      if (response.status !== 429) {
        return;
      }
    } catch {
      // Ignore fetch errors, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timeout waiting for ${description} after ${timeoutMs}ms (${attempts} attempts). ` +
      `Last status: ${lastStatus}, Retry-After: ${lastRetryAfter}`
  );
}

/**
 * Wait for a specific HTTP status from an endpoint.
 *
 * @param url - Full URL to poll
 * @param expectedStatus - Expected HTTP status code
 * @param options - Polling configuration
 * @returns The response when expected status is received
 */
export async function waitForStatus(
  url: string,
  expectedStatus: number,
  options: PollingOptions & { method?: string; headers?: Record<string, string> } = {}
): Promise<Response> {
  const {
    timeoutMs = 15000,
    intervalMs = 300,
    description = `status ${expectedStatus}`,
    method = 'GET',
    headers = {},
  } = options;

  const startTime = Date.now();
  let attempts = 0;
  let lastStatus = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    try {
      const response = await fetch(url, { method, headers });
      lastStatus = response.status;

      if (response.status === expectedStatus) {
        return response;
      }
    } catch {
      // Ignore fetch errors, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timeout waiting for ${description} at ${url} after ${timeoutMs}ms (${attempts} attempts). ` +
      `Last status: ${lastStatus}`
  );
}

/**
 * Helper to poll for specific webhook event.
 *
 * @param receiverUrl - Webhook receiver's event list endpoint
 * @param filter - Function to match expected event
 * @param options - Polling configuration
 * @returns The matched webhook payload or null if not found within timeout
 */
export async function waitForWebhookEvent(
  receiverUrl: string,
  filter: (event: any) => boolean,
  options: { timeoutMs?: number; intervalMs?: number; description?: string } = {}
): Promise<any> {
  const { timeoutMs = CONFIG.TIMEOUTS.WEBHOOK_DELIVERY, intervalMs = 250, description = 'webhook delivery' } = options;

  const startTime = Date.now();
  let attempts = 0;
  let lastPayloads: any[] = [];

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    try {
      const response = await fetch(receiverUrl);
      if (response.ok) {
        const data = await response.json();
        lastPayloads = Array.isArray(data) ? data : [];

        const match = lastPayloads.find(filter);
        if (match) {
          return match;
        }
      }
    } catch {
      // Ignore fetch errors, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timeout waiting for ${description} after ${timeoutMs}ms (${attempts} attempts). ` +
      `Last seen payloads: ${JSON.stringify(lastPayloads.slice(-3), null, 2)}`
  );
}

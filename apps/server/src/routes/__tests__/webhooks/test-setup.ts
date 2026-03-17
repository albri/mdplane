import { Elysia } from 'elysia';
import { ssrfConfig } from '../../../core/ssrf';
import { createTestApp } from '../../../../tests/helpers';
import { createTestWorkspace, type TestWorkspace } from '../../../../tests/fixtures';
import { createExpiredKey, createRevokedKey } from '../../../../tests/fixtures/capability-key';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

export { assertValidResponse };
export { ssrfConfig };

// Mock HTTP Server for Webhook Tests
interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

let mockServer: ReturnType<typeof Bun.serve> | null = null;
let mockReceivedRequests: MockRequest[] = [];
let mockResponseCode = 200;
let mockResponseBody: unknown = { ok: true };
let mockResponseHeaders: Record<string, string> = {};
let mockPort = 0;

export function getMockServerUrl(): string {
  return `http://127.0.0.1:${mockPort}`;
}

export function setMockResponse(
  code: number,
  body: unknown = { ok: true },
  headers: Record<string, string> = {}
): void {
  mockResponseCode = code;
  mockResponseBody = body;
  mockResponseHeaders = headers;
}

export function getReceivedRequests(): MockRequest[] {
  return mockReceivedRequests;
}

export function clearReceivedRequests(): void {
  mockReceivedRequests = [];
}

export async function startMockServer(): Promise<void> {
  mockServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const clonedReq = req.clone();
      let body: unknown = null;
      try {
        const text = await clonedReq.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch {
        // Body is not JSON or empty
      }

      const headers: Record<string, string> = {};
      clonedReq.headers.forEach((value, key) => {
        headers[key] = value;
      });

      mockReceivedRequests.push({
        method: req.method,
        url: req.url,
        headers,
        body,
      });

      return new Response(JSON.stringify(mockResponseBody), {
        status: mockResponseCode,
        headers: {
          'Content-Type': 'application/json',
          ...mockResponseHeaders,
        },
      });
    },
  });
  mockPort = mockServer.port ?? 0;
}

export function stopMockServer(): void {
  if (mockServer) {
    mockServer.stop();
    mockServer = null;
  }
  mockReceivedRequests = [];
  mockResponseCode = 200;
  mockResponseBody = { ok: true };
  mockResponseHeaders = {};
}

// Webhook format patterns from specification
export const WEBHOOK_ID_PATTERN = /^wh_[A-Za-z0-9]+$/;
export const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]+$/;
export const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
export const INVALID_KEY = 'short';

// Valid webhook events from OpenAPI spec
export const VALID_EVENTS = [
  'append', 'append.created', 'task.created', 'task.claimed', 'task.completed',
  'task.cancelled', 'task.blocked', 'task.unblocked', 'task.overdue',
  'task.escalated', 'task.recurred', 'task.expired', 'claim.created',
  'claim.expired', 'claim.renewed', 'file.created', 'file.updated',
  'file.deleted', 'heartbeat', 'webhook.failed', 'settings.changed',
];

export type TestApp = Elysia;

export interface WebhookTestContext {
  app: Elysia;
  testWorkspace: TestWorkspace;
  adminKey: string;
  appendKey: string;
  readKey: string;
  expiredKey: string;
  revokedKey: string;
}

export async function setupWebhookTests(): Promise<WebhookTestContext> {
  await startMockServer();
  const app = createTestApp();
  ssrfConfig.allowList.push('localhost', '127.0.0.1');
  const testWorkspace = await createTestWorkspace(app);
  return {
    app,
    testWorkspace,
    adminKey: testWorkspace.writeKey,
    appendKey: testWorkspace.appendKey,
    readKey: testWorkspace.readKey,
    expiredKey: createExpiredKey(testWorkspace, 'write'),
    revokedKey: createRevokedKey(testWorkspace, 'write'),
  };
}

export function teardownWebhookTests(): void {
  stopMockServer();
  ssrfConfig.allowList.length = 0;
}

export function resetMockServer(): void {
  clearReceivedRequests();
  setMockResponse(200, { ok: true });
}



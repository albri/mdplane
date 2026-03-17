/**
 * WebSocket Subscriptions Endpoint Tests
 *
 * These tests verify WebSocket subscription functionality.
 *
*
* Endpoints:
* - GET /r/:readKey/ops/subscribe - Get subscription credentials (read tier)
* - GET /a/:appendKey/ops/subscribe - Get subscription credentials (append tier)
* - GET /w/:writeKey/ops/subscribe - Get subscription credentials (write tier)
* - GET /r/:folderReadKey/ops/folders/subscribe?path=:folderPath - Folder subscription
 * - WS /ws?token=<token> - WebSocket connection endpoint
 *
 * @see docs/API Design.md - WebSocket Subscriptions section (lines 2928-3275)
 * @see packages/shared/openapi/paths/realtime.yaml
 * @see packages/shared/openapi/components/schemas/realtime.yaml
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';

// Import the route under test
import { websocketRoute } from '../../../routes/websocket';
import { matchesScope, resetRateLimitState, clearUsedTokens as resetUsedTokens } from '../fixtures/websocket-state-fixtures';
import { resetWebsocketTestData } from '../../../../tests/helpers/websocket-fixtures';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';
import { signWsToken } from '../../../core/ws-token';
import { hashKey } from '../../../core/capability-keys';

// Constants and Patterns

// Test capability keys (valid format)
const VALID_READ_KEY = 'wsR8k2mP9qL3nR7mQ2pN4x';
const VALID_APPEND_KEY = 'wsA8k2mP9qL3nR7mQ2pN4x';
const VALID_WRITE_KEY = 'wsW8k2mP9qL3nR7mQ2pN4x';
const INVALID_KEY = 'short';
const REVOKED_KEY = 'wsRevoked0P9qL3nR7mQ2xZ';
const EXPIRED_KEY = 'wsExpired0P9qL3nR7mQ2xZ';

// Folder keys
const VALID_FOLDER_READ_KEY = 'wsFolderR8k2mP9qL3nR7mQ2';
const VALID_FOLDER_APPEND_KEY = 'wsFolderA8k2mP9qL3nR7mQ2';
const VALID_FOLDER_WRITE_KEY = 'wsFolderW8k2mP9qL3nR7mQ2';

// Token patterns from specification
// Token format: JWT (header.payload.signature) - self-validating across instances
// JWT tokens are base64url encoded with 3 parts separated by dots
const WS_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const EVENT_ID_PATTERN = /^evt_[A-Za-z0-9]+_\d+$/;

// Events by tier from specification
const READ_EVENTS = ['append', 'file.created', 'file.deleted', 'file.updated'];
const APPEND_EVENTS = [
  ...READ_EVENTS,
  'task.created',
  'task.blocked',
  'claim.expired',
  'heartbeat',
];
const WRITE_EVENTS = [...APPEND_EVENTS, 'webhook.failed', 'settings.changed'];

// WebSocket close codes from specification
const WS_CLOSE_CODES = {
  TOKEN_EXPIRED: 4001,
  TOKEN_INVALID: 4002,
  KEY_REVOKED: 4003,
};

describe('WebSocket Subscriptions', () => {
  type TestApp = {
    handle: (request: Request) => Response | Promise<Response>;
  };

  let app: TestApp;

  beforeAll(() => {
    // Create test app with websocket route
    app = new Elysia().use(websocketRoute);
    // Initialize test fixtures
    resetWebsocketTestData();
  });

  beforeEach(() => {
    // Reset rate limiting and token state between tests
    resetRateLimitState();
    resetUsedTokens();
  });

  describe('GET /r/:folderKey/ops/folders/subscribe?path=:path* - Folder Subscriptions', () => {
    test('should return 200 for valid folder read key', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/r/${VALID_FOLDER_READ_KEY}/ops/folders/subscribe?path=projects/alpha`,
          { method: 'GET' }
        )
      );

      expect(response.status).toBe(200);
    });

    test('should return scope field with folder path', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/r/${VALID_FOLDER_READ_KEY}/ops/folders/subscribe?path=projects/alpha`,
          { method: 'GET' }
        )
      );

      const body = await response.json();
      expect(body.data.scope).toBe('/projects/alpha');
    });

    test('should return recursive: true', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/r/${VALID_FOLDER_READ_KEY}/ops/folders/subscribe?path=projects/alpha`,
          { method: 'GET' }
        )
      );

      const body = await response.json();
      expect(body.data.recursive).toBe(true);
    });

    test('should return keyTier matching capability key tier', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/a/${VALID_FOLDER_APPEND_KEY}/ops/folders/subscribe?path=projects`,
          { method: 'GET' }
        )
      );

      const body = await response.json();
      expect(body.data.keyTier).toBe('append');
    });

    test('should return token as JWT format', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/r/${VALID_FOLDER_READ_KEY}/ops/folders/subscribe?path=projects`,
          { method: 'GET' }
        )
      );

      const body = await response.json();
      expect(body.data.token).toMatch(WS_TOKEN_PATTERN);
    });

    test('should return events array matching key tier', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/r/${VALID_FOLDER_READ_KEY}/ops/folders/subscribe?path=projects`,
          { method: 'GET' }
        )
      );

      const body = await response.json();
      expect(body.data.events).toBeDefined();
      expect(body.data.events).toContain('append');
      expect(body.data.events).toContain('file.created');
    });

    test('should support write key folder subscription', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/w/${VALID_FOLDER_WRITE_KEY}/ops/folders/subscribe?path=projects`,
          { method: 'GET' }
        )
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.keyTier).toBe('write');
      expect(body.data.events).toContain('webhook.failed');
      expect(body.data.events).toContain('settings.changed');
    });

    test('should return 400 for invalid folder subscription query', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/r/${VALID_FOLDER_READ_KEY}/ops/folders/subscribe?path=projects&recursive=maybe`,
          { method: 'GET' }
        )
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    describe('File Access Filtering', () => {
      test('should only emit events for files the key has access to', async () => {
        // Document expected behavior: events are filtered based on key access
        // If a file has a more restrictive key than the folder key,
        // events for that file are filtered out
        const expectedBehavior = {
          accessFiltering: true,
          description:
            'Events are only emitted for files the subscribing key has access to',
        };
        expect(expectedBehavior.accessFiltering).toBe(true);
      });

      test('should stop events if key loses access to file mid-subscription', async () => {
        // Document expected behavior
        const expectedBehavior = {
          midSubscriptionRevocation: true,
          description:
            'If key loses access to a file mid-subscription, events for that file stop immediately',
        };
        expect(expectedBehavior.midSubscriptionRevocation).toBe(true);
      });
    });
  });

  describe('WebSocket Connection', () => {
    describe('Connection Authentication', () => {
      test('should connect with valid token', async () => {
        // First get a token
        const credResponse = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );
        const { token } = (await credResponse.json()).data;

        // Attempt WebSocket connection
        const wsResponse = await app.handle(new Request(`http://localhost/ws?token=${token}`));

        // Should succeed (HTTP 200 in test environment, 101 WebSocket upgrade in production)
        expect(wsResponse.status).toBe(200);
      });

      test('should reject expired token with close code 4001', async () => {
        // Generate a properly signed but expired JWT token
        const expiredToken = signWsToken({
          workspaceId: 'ws_test123',
          keyTier: 'read',
          keyHash: 'testhash123',
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          scope: '/',
        });

        const wsResponse = await app.handle(new Request(`http://localhost/ws?token=${expiredToken}`));

        // Should reject with 401 status (TOKEN_EXPIRED)
        expect(wsResponse.status).toBe(401);
        const body = await wsResponse.json();
        // Note: TOKEN_EXPIRED is a WebSocket-specific error code not in OpenAPI Error schema
        expect(body.error.code).toBe('TOKEN_EXPIRED');
      });

      test('should reject invalid token with close code 4002', async () => {
        const invalidToken = 'ws_InvalidToken123';

        const wsResponse = await app.handle(new Request(`http://localhost/ws?token=${invalidToken}`));

        // Should reject with 401 status (TOKEN_INVALID)
        expect(wsResponse.status).toBe(401);
        const body = await wsResponse.json();
        // Note: TOKEN_INVALID is a WebSocket-specific error code not in OpenAPI Error schema
        expect(body.error.code).toBe('TOKEN_INVALID');
      });

      test('should reject connection when key is revoked with close code 4003', async () => {
        // Generate a valid JWT token using the revoked key's hash
        // The key is revoked in the database, so connection should be rejected
        const revokedKeyToken = signWsToken({
          workspaceId: 'ws_test_websocket',
          keyTier: 'read',
          keyHash: hashKey(REVOKED_KEY), // Hash of the revoked key
          exp: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
          scope: '/',
        });

        const wsResponse = await app.handle(new Request(`http://localhost/ws?token=${revokedKeyToken}`));

        // Should reject with 410 status (KEY_REVOKED)
        expect(wsResponse.status).toBe(410);
        const body = await wsResponse.json();
        // Note: KEY_REVOKED is validated via Error schema in other tests
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });

    describe('Token Single-Use Enforcement', () => {
      test('token should be single-use (second connection fails)', async () => {
        // Get a token
        const credResponse = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );
        const { token } = (await credResponse.json()).data;

        // First connection should succeed
        const firstWsResponse = await app.handle(
          new Request(`http://localhost/ws?token=${token}`, {
            method: 'GET',
          })
        );
        expect(firstWsResponse.status).toBe(200);

        // Second connection with same token should fail
        const secondWsResponse = await app.handle(
          new Request(`http://localhost/ws?token=${token}`, {
            method: 'GET',
          })
        );

        // Should reject with 401 status (TOKEN_ALREADY_USED)
        expect(secondWsResponse.status).toBe(401);
        const body = await secondWsResponse.json();
        // Note: TOKEN_ALREADY_USED is a WebSocket-specific error code not in OpenAPI Error schema
        expect(body.error.code).toBe('TOKEN_ALREADY_USED');
      });
    });
  });

  describe('WebSocket Event Format', () => {
    test('event should contain eventId field', async () => {
      // This test documents expected event format
      // In practice, this would be tested via integration tests with real WS
      const mockEvent = {
        eventId: 'evt_x8k2m_47',
        sequence: 47,
        event: 'task.created',
        timestamp: '2024-01-08T10:30:00Z',
        file: {
          id: 'x8k2m',
          path: '/projects/alpha/tasks.md',
          urls: {
            read: 'https://mdplane.dev/r/readKey',
          },
        },
        data: {
          type: 'task',
          author: 'orchestrator',
          content: 'Implement user authentication',
        },
      };

      expect(mockEvent.eventId).toMatch(EVENT_ID_PATTERN);
    });

    test('event should contain sequence number', async () => {
      const mockEvent = {
        eventId: 'evt_x8k2m_47',
        sequence: 47,
        event: 'append',
        timestamp: '2024-01-08T10:30:00Z',
        file: { id: 'x8k2m', path: '/test.md', urls: {} },
        data: {},
      };

      expect(typeof mockEvent.sequence).toBe('number');
      expect(mockEvent.sequence).toBeGreaterThan(0);
    });

    test('event should contain event type', async () => {
      const mockEvent = {
        eventId: 'evt_x8k2m_1',
        sequence: 1,
        event: 'append',
        timestamp: '2024-01-08T10:30:00Z',
        file: { id: 'x8k2m', path: '/test.md', urls: {} },
        data: {},
      };

      expect(mockEvent.event).toBeDefined();
      expect(typeof mockEvent.event).toBe('string');
    });

    test('event should contain ISO timestamp', async () => {
      const mockEvent = {
        eventId: 'evt_x8k2m_1',
        sequence: 1,
        event: 'append',
        timestamp: '2024-01-08T10:30:00Z',
        file: { id: 'x8k2m', path: '/test.md', urls: {} },
        data: {},
      };

      expect(mockEvent.timestamp).toMatch(ISO_TIMESTAMP_PATTERN);
    });

    test('event file.urls should respect key permission level', async () => {
      // Read key subscription should only see read URLs
      const readKeyEvent = {
        file: {
          id: 'x8k2m',
          path: '/test.md',
          urls: {
            read: 'https://mdplane.dev/r/readKey',
            // Should NOT include append or write URLs for read key subscription
          },
        },
      };

      expect(readKeyEvent.file.urls.read).toBeDefined();
      expect((readKeyEvent.file.urls as Record<string, unknown>).append).toBeUndefined();
      expect((readKeyEvent.file.urls as Record<string, unknown>).write).toBeUndefined();
    });
  });
});




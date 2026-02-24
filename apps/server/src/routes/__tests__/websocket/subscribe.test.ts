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

  describe('GET /r/:readKey/ops/subscribe - Read Key Subscription', () => {
    describe('Successful Response', () => {
      test('should return 200 for valid read key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
      });

      test('should return ok: true in response', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return wsUrl field', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.wsUrl).toBeDefined();
        expect(body.data.wsUrl).toMatch(/^wss?:\/\//);
      });

      test('should return token as JWT format (header.payload.signature)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.token).toBeDefined();
        expect(body.data.token).toMatch(WS_TOKEN_PATTERN);
      });

      test('should return expiresAt as valid ISO timestamp', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.expiresAt).toBeDefined();
        expect(body.data.expiresAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should return token that expires in 1 hour', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const expiresAt = new Date(body.data.expiresAt);
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        const diffMinutes = diffMs / (1000 * 60);

        // Should be approximately 60 minutes (allow 1 minute tolerance)
        expect(diffMinutes).toBeGreaterThan(58);
        expect(diffMinutes).toBeLessThanOrEqual(61);
      });

      test('should return events array for read tier', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.events).toBeDefined();
        expect(Array.isArray(body.data.events)).toBe(true);
        // Read tier events: append, file.created, file.deleted, file.updated
        expect(body.data.events).toContain('append');
        expect(body.data.events).toContain('file.created');
        expect(body.data.events).toContain('file.deleted');
      });

      test('should return keyTier as "read"', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.keyTier).toBe('read');
      });

      test('should NOT include task/claim events for read key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.events).not.toContain('task.created');
        expect(body.data.events).not.toContain('claim.expired');
        expect(body.data.events).not.toContain('heartbeat');
      });
    });

    describe('Error Responses', () => {
      test('should return 404 for invalid key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        assertValidResponse(body, 'Error');
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
      });

      test('should return 410 for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${REVOKED_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(410);
        const body = await response.json();
        assertValidResponse(body, 'Error');
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });

      test('should return 404 for expired key (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${EXPIRED_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
        expect(body.error.message).toBe('Key not found');
      });

      test('should return 404 when read key used on /a/ endpoint (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
        expect(body.error.message).toBe('Key not found');
      });

      test('should return 404 when read key used on /w/ endpoint (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
        expect(body.error.message).toBe('Key not found');
      });

      test('should return 404 when append key used on /w/ endpoint (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_APPEND_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
        expect(body.error.message).toBe('Key not found');
      });
    });
  });

  describe('GET /a/:appendKey/ops/subscribe - Append Key Subscription', () => {
    test('should return 200 for valid append key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/ops/subscribe`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
    });

    test('should return keyTier as "append"', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/ops/subscribe`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.keyTier).toBe('append');
    });

    test('should include read events', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/ops/subscribe`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.events).toContain('append');
      expect(body.data.events).toContain('file.created');
      expect(body.data.events).toContain('file.deleted');
    });

    test('should include task/claim events', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/ops/subscribe`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.events).toContain('task.created');
      expect(body.data.events).toContain('claim.expired');
      expect(body.data.events).toContain('task.blocked');
      expect(body.data.events).toContain('heartbeat');
    });

    test('should NOT include admin events for append key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/ops/subscribe`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.events).not.toContain('webhook.failed');
      expect(body.data.events).not.toContain('settings.changed');
    });
  });

  describe('GET /w/:writeKey/ops/subscribe - Write Key Subscription', () => {
    test('should return 200 for valid write key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/subscribe`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
    });

    test('should return keyTier as "write"', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/subscribe`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.keyTier).toBe('write');
    });

    test('should include all events including admin events', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/subscribe`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      // Read events
      expect(body.data.events).toContain('append');
      expect(body.data.events).toContain('file.created');
      expect(body.data.events).toContain('file.deleted');
      // Append events
      expect(body.data.events).toContain('task.created');
      expect(body.data.events).toContain('claim.expired');
      expect(body.data.events).toContain('task.blocked');
      expect(body.data.events).toContain('heartbeat');
      // Admin events
      expect(body.data.events).toContain('webhook.failed');
      expect(body.data.events).toContain('settings.changed');
    });
  });

  describe('Rate Limiting', () => {
    test('should not rate limit in unit tests', async () => {
      // Rate limiting is disabled for NODE_ENV=test to keep unit tests deterministic.
      const responses = [];
      for (let i = 0; i < 11; i++) {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
            method: 'GET',
          })
        );
        responses.push(response);
      }

      // All requests should succeed
      for (const r of responses) {
        expect(r.status).toBe(200);
      }
    });

    test('should not include Retry-After header in unit tests', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Retry-After')).toBeNull();
    });

    test('should ignore X-Smoke-Test-Bypass header (bypass mechanism removed)', async () => {
      // Reset rate limit state
      resetRateLimitState();

      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/ops/subscribe`, {
          method: 'GET',
          headers: {
            'X-Smoke-Test-Bypass': 'any-secret-value',
          },
        })
      );

      // X-Smoke-Test-Bypass header is no longer supported - it's ignored
      // Request should still work normally (subject to rate limits)
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      // Token should be valid JWT format
      expect(body.data.token).toMatch(WS_TOKEN_PATTERN);
      // Token payload should not include bypassLimits field
      const tokenParts = body.data.token.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf-8'));
      expect(payload.bypassLimits).toBeUndefined();
    });
  });
});


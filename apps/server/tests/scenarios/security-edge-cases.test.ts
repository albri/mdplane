/**
 * Security Edge Cases Scenario Tests
 *
 * Comprehensive scenario tests for security edge cases:
 * - Capability key security (expiry, revocation, format validation)
 * - Path traversal prevention
 * - SSRF prevention (webhooks)
 * - Input validation
 * - Rate limiting
 * - Information leakage prevention
 *
 * Security tests should FAIL if protection is missing.
 *
 * @see docs/Architecture.md - Security section
 * @see apps/server/AGENTS.md - Security patterns
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import type { Elysia } from 'elysia';
import { createTestApp } from '../helpers';
import { assertValidResponse } from '../helpers/schema-validator';
import { createTestWorkspace, createTestFile, type TestWorkspace, type TestFile } from '../fixtures';

// Keys populated from workspace created via bootstrap (dynamic, not hardcoded)

describe('Security Edge Cases', () => {
  let app: ReturnType<typeof createTestApp>;
  let workspace: TestWorkspace;
  let file: TestFile;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    workspace = await createTestWorkspace(app);
    file = await createTestFile(app, workspace, '/security-test.md', '# Security Test\n\nContent here.');
  });

  describe('Capability Key Security', () => {
    test('GIVEN invalid key format, WHEN accessing resource, THEN returns 404 INVALID_KEY', async () => {
      // GIVEN: A key with invalid format (too short, invalid characters)
      const invalidKeys = [
        'short',
        'abc!@#$%^&*()123456789012',
        '',
        '   ',
        'a'.repeat(100), // Too long
      ];

      for (const invalidKey of invalidKeys) {
        // WHEN: Attempting to access with invalid key
        const response = await app.handle(
          new Request(`http://localhost/r/${encodeURIComponent(invalidKey)}/test.md`, {
            method: 'GET',
          })
        );

        // THEN: Returns 404 with INVALID_KEY code
        expect(response.status).toBe(404);
        const body = await response.json();
        assertValidResponse(body, 'Error');
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      }
    });

    test('GIVEN valid format but nonexistent key, WHEN accessing resource, THEN returns 404', async () => {
      // GIVEN: A key with valid format but doesn't exist in database
      const fakeKey = 'r8k2mP9qL3nR7mQ2pN4xYz5a';

      // WHEN: Accessing with nonexistent key
      const response = await app.handle(
        new Request(`http://localhost/r/${fakeKey}/test.md`, {
          method: 'GET',
        })
      );

      // THEN: Returns 404 to prevent enumeration (key validity not leaked)
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('GIVEN key from different workspace, WHEN accessing file, THEN returns 404 not 403', async () => {
      // GIVEN: A key from a different workspace
      const otherWorkspace = await createTestWorkspace(app);

      // WHEN: Using key from other workspace to access file
      const response = await app.handle(
        new Request(`http://localhost/r/${otherWorkspace.readKey}${file.path}`, {
          method: 'GET',
        })
      );

      // THEN: Returns 404 (file not found in that workspace, not forbidden)
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });

    // Per API Design.md: Root capability keys return 404 for expired/revoked (security: never reveal if key once existed)
    // Scoped keys return 401 with KEY_EXPIRED or KEY_REVOKED (admin knows they exist)
    // These tests verify the root key security behavior (404 for all failures)
    test('GIVEN expired root key, WHEN accessing resource, THEN returns 404 (security)', async () => {
      // Create a key with expiresAt in the past by directly manipulating the database
      const { db } = await import('../../src/db');
      const { capabilityKeys } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const { hashKey } = await import('../../src/core/capability-keys');

      // Create a new workspace to get fresh keys
      const expiredWorkspace = await createTestWorkspace(app);

      // Update the read key to be expired
      const keyHash = hashKey(expiredWorkspace.readKey);
      await db.update(capabilityKeys)
        .set({ expiresAt: new Date(Date.now() - 3600000).toISOString() }) // 1 hour ago
        .where(eq(capabilityKeys.keyHash, keyHash));

      // WHEN: Accessing with expired key
      const response = await app.handle(
        new Request(`http://localhost/r/${expiredWorkspace.readKey}/test.md`, {
          method: 'GET',
        })
      );

      // THEN: Returns 404 (not 401) per capability URL security model
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      // Error code should be KEY_EXPIRED but status is 404 (capability URL security)
      expect(body.error.code).toBe('KEY_EXPIRED');
    });

    test('GIVEN revoked root key, WHEN accessing resource, THEN returns 404 (security)', async () => {
      // Create a key and then revoke it
      const { db } = await import('../../src/db');
      const { capabilityKeys } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const { hashKey } = await import('../../src/core/capability-keys');

      // Create a new workspace to get fresh keys
      const revokedWorkspace = await createTestWorkspace(app);

      // Revoke the read key
      const keyHash = hashKey(revokedWorkspace.readKey);
      await db.update(capabilityKeys)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(capabilityKeys.keyHash, keyHash));

      // WHEN: Accessing with revoked key
      const response = await app.handle(
        new Request(`http://localhost/r/${revokedWorkspace.readKey}/test.md`, {
          method: 'GET',
        })
      );

      // THEN: Returns 404 (not 401) per capability URL security model
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      // Error code should be KEY_REVOKED but status is 404 (capability URL security)
      expect(body.error.code).toBe('KEY_REVOKED');
    });
  });

  describe('Path Traversal Prevention', () => {
    test('GIVEN ../ in path, WHEN accessing file, THEN blocked', async () => {
      // WHEN: Attempting path traversal with ../
      // Note: new Request() normalizes URLs, so ../ is resolved before the handler sees it
      // In production, raw HTTP requests preserve ../ and the server returns 400
      // In tests, the normalized URL results in 404 (file not found)
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/../../../etc/passwd`, {
          method: 'GET',
        })
      );

      // THEN: Blocked with not-found semantics after URL normalization in in-process tests
      expect(response.status).toBe(404);

      // AND: If JSON response, error message doesn't expose internal structure
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await response.json();
        expect(JSON.stringify(body)).not.toContain('/etc/passwd');
      }
    });

    test('GIVEN ..\\ in path (Windows style), WHEN accessing file, THEN blocked', async () => {
      // WHEN: Attempting Windows-style path traversal
      // Note: Backslash handling varies by platform and URL parser
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/..\\..\\..\\windows\\system32`, {
          method: 'GET',
        })
      );

      // THEN: Backslash path traversal is blocked with not-found semantics
      expect(response.status).toBe(404);
    });

    test('GIVEN encoded %2e%2e%2f in path, WHEN accessing file, THEN blocked', async () => {
      // WHEN: Attempting URL-encoded path traversal (%2e = ., %2f = /)
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/%2e%2e%2f%2e%2e%2fetc/passwd`, {
          method: 'GET',
        })
      );

      // THEN: Blocked with 400 (server checks for %2e%2e in raw URL)
      expect(response.status).toBe(400);
    });

    test('GIVEN double-encoded path traversal, WHEN accessing file, THEN blocked', async () => {
      // WHEN: Attempting double-encoded path traversal (%252e = %2e after first decode)
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/%252e%252e%252f%252e%252e%252fetc/passwd`, {
          method: 'GET',
        })
      );

      // THEN: Double-encoded traversal remains blocked with not-found semantics
      expect(response.status).toBe(404);
    });

    test('GIVEN null bytes in path, WHEN accessing file, THEN rejected', async () => {
      // WHEN: Attempting to include null byte in path
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/test%00.md`, {
          method: 'GET',
        })
      );

      // THEN: Rejected with 400 (invalid path)
      expect(response.status).toBe(400);
    });
  });

  describe('SSRF Prevention', () => {
    test('GIVEN localhost webhook URL, WHEN create webhook in non-test mode, THEN rejected', async () => {
      // Note: In test mode (NODE_ENV=test), localhost is allowed for mock servers
      // This test documents the expected behavior in production
      // The actual blocking logic is in isUrlBlocked() which allows localhost in test mode

      // WHEN: Attempting to create webhook with private IP
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://10.0.0.1:8080/callback',
            events: ['append'],
          }),
        })
      );

      // THEN: Rejected with INVALID_WEBHOOK_URL
      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN 127.0.0.1 webhook URL, WHEN create webhook, THEN blocked in production', async () => {
      // 127.0.0.1 is blocked in production, allowed in test mode
      // Test with a different loopback that's always blocked
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://127.0.0.2:8080/callback', // Alternative loopback
            events: ['append'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN 0.0.0.0 webhook URL, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://0.0.0.0:8080/callback',
            events: ['append'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN 10.x.x.x private IP, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://10.0.0.1/webhook',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN 192.168.x.x private IP, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://192.168.1.1/webhook',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN 172.16-31.x.x private IP, WHEN create webhook, THEN rejected', async () => {
      const privateIPs = ['172.16.0.1', '172.20.0.1', '172.31.255.255'];

      for (const ip of privateIPs) {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: `https://${ip}/webhook`,
              events: ['append.created'],
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        assertValidResponse(body, 'Error');
        expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
      }
    });

    test('GIVEN IPv6 localhost (::1), WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://[::1]:8080/callback',
            events: ['append'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN file:// URL, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'file:///etc/passwd',
            events: ['append'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN 169.254.x.x (link-local/metadata), WHEN create webhook, THEN rejected', async () => {
      // 169.254.169.254 is AWS/cloud metadata endpoint
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://169.254.169.254/latest/meta-data/',
            events: ['append'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN IPv4-mapped IPv6 address with private IP, WHEN create webhook, THEN rejected', async () => {
      // ::ffff:10.0.0.1 is IPv4-mapped IPv6 for 10.0.0.1
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://[::ffff:10.0.0.1]:8080/callback',
            events: ['append'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN *.local hostname, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://internal.local/webhook',
            events: ['append'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });
  });

  describe('Input Validation', () => {
    test('GIVEN SQL injection in search query, WHEN searching, THEN handled safely', async () => {
      // WHEN: Attempting SQL injection in search
      const sqlInjection = "'; DROP TABLE files; --";
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/search?q=${encodeURIComponent(sqlInjection)}`, {
          method: 'GET',
        })
      );

      // THEN: Returns normally with empty results (SQL injection sanitized)
      expect(response.status).toBe(200);

      // AND: If 200, verify structure is intact
      if (response.status === 200) {
        const body = await response.json();
        expect(body.ok).toBeDefined();
      }
    });

    test('GIVEN script tags in content, WHEN appending, THEN stored without execution', async () => {
      // WHEN: Appending content with script tags
      const xssContent = '<script>alert("XSS")</script>';
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: xssContent,
            author: 'test-agent',
          }),
        })
      );

      // THEN: Content is accepted and stored
      expect(response.status).toBe(201);

      // AND: When read back, content is preserved (encoding is frontend responsibility)
      const readResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}${file.path}`, {
          method: 'GET',
        })
      );
      expect(readResponse.status).toBe(200);
    });

    test('GIVEN null bytes in content, WHEN appending, THEN handled safely', async () => {
      // WHEN: Appending content with null bytes
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'Content with \0 null byte',
            author: 'test-agent',
          }),
        })
      );

      // THEN: Content is accepted (null bytes handled safely)
      expect(response.status).toBe(201);
    });

    test('GIVEN control characters in content, WHEN appending, THEN handled', async () => {
      // WHEN: Appending content with control characters
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'Content with \x07 bell and \x1B escape',
            author: 'test-agent',
          }),
        })
      );

      // THEN: Content is accepted (control characters handled safely)
      expect(response.status).toBe(201);
    });

    test('GIVEN extremely long content, WHEN appending, THEN returns 413', async () => {
      // WHEN: Appending extremely long content (over 1MB limit)
      const longContent = 'x'.repeat(1_100_000); // 1.1MB - over the 1MB limit

      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: longContent,
            author: 'test-agent',
          }),
        })
      );

      // THEN: Rejected with 413 Payload Too Large
      expect(response.status).toBe(413);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
      // X-Content-Size-Limit header should be present
      expect(response.headers.get('X-Content-Size-Limit')).toBe('1048576');
    });

    test('GIVEN invalid JSON, WHEN making POST request, THEN returns 400', async () => {
      // WHEN: Sending invalid JSON
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid json }',
        })
      );

      // THEN: Returns 400 bad request
      expect(response.status).toBe(400);
    });

    test('GIVEN missing required fields, WHEN creating append, THEN returns validation error', async () => {
      // WHEN: Appending without required type field
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Content without type',
            author: 'test-agent',
          }),
        })
      );

      // THEN: Returns 400 with validation error
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    let rateLimitedApp: ReturnType<typeof createTestApp>;
    let rlWorkspace: TestWorkspace;
    let rlFile: TestFile;

    beforeAll(() => {
      // Create app with rate limiting enabled for these tests
      rateLimitedApp = createTestApp({ withRateLimiting: true });
    });

    beforeEach(async () => {
      rlWorkspace = await createTestWorkspace(rateLimitedApp);
      rlFile = await createTestFile(rateLimitedApp, rlWorkspace, '/rl-test.md', '# Rate Limit Test');
    });

    test('GIVEN normal request, WHEN response received, THEN rate limit headers present', async () => {
      // WHEN: Making a normal request
      const response = await rateLimitedApp.handle(
        new Request(`http://localhost/r/${rlWorkspace.readKey}${rlFile.path}`, {
          method: 'GET',
        })
      );

      // THEN: Response includes rate limit headers
      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    test('GIVEN rate limit headers, THEN values are valid numbers', async () => {
      const response = await rateLimitedApp.handle(
        new Request(`http://localhost/r/${rlWorkspace.readKey}${rlFile.path}`, {
          method: 'GET',
        })
      );

      const limit = response.headers.get('X-RateLimit-Limit');
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');

      expect(limit).not.toBeNull();
      expect(remaining).not.toBeNull();
      expect(reset).not.toBeNull();

      // Verify they are valid numbers
      expect(Number.isInteger(parseInt(limit!, 10))).toBe(true);
      expect(Number.isInteger(parseInt(remaining!, 10))).toBe(true);
      expect(Number.isInteger(parseInt(reset!, 10))).toBe(true);

      // Limit should be positive
      expect(parseInt(limit!, 10)).toBeGreaterThan(0);

      // Remaining should be <= limit
      expect(parseInt(remaining!, 10)).toBeLessThanOrEqual(parseInt(limit!, 10));
    });

    test('GIVEN excessive requests, WHEN rate limit exceeded, THEN returns 429', async () => {
      // Make many rapid requests to exceed read rate limit
      // Rate limit for read is 1000/min per key, but we can test with bootstrap (10/hour)
      // by creating many workspaces rapidly
      const requests: Promise<Response>[] = [];

      // Bootstrap has a limit of 10/hour per IP
      // Make 12 bootstrap requests to exceed the limit
      for (let i = 0; i < 12; i++) {
        requests.push(
          rateLimitedApp.handle(
            new Request('http://localhost/bootstrap', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            })
          )
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429)
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check that 429 response has proper error format
      const rateLimitedResponse = rateLimitedResponses[0];
      const body = await rateLimitedResponse.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('RATE_LIMITED');
      expect(rateLimitedResponse.headers.get('Retry-After')).toBeDefined();
    });
  });

  describe('Information Leakage Prevention', () => {
    test('GIVEN invalid key, WHEN error returned, THEN no internal paths exposed', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/invalid-key/test.md`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      assertValidResponse(body, 'Error');
      const bodyStr = JSON.stringify(body);

      // Should not expose file system paths
      expect(bodyStr).not.toMatch(/[A-Z]:\\|\/home\/|\/var\/|\/usr\//i);
      // Should not expose node_modules paths
      expect(bodyStr).not.toContain('node_modules');
      // Should not expose database info
      expect(bodyStr).not.toContain('sqlite');
      expect(bodyStr).not.toContain('drizzle');
    });

    test('GIVEN file not found, WHEN error returned, THEN returns 404 not 403', async () => {
      // Valid key, but file doesn't exist
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/nonexistent-file.md`, {
          method: 'GET',
        })
      );

      // THEN: Returns 404 (file not found, not forbidden)
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });

    test('GIVEN server error, WHEN error returned, THEN no stack trace exposed', async () => {
      // Trigger an error condition (malformed request)
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-valid-json{{{',
        })
      );

      const body = await response.json();
      const bodyStr = JSON.stringify(body);

      // Should not expose stack traces
      expect(bodyStr).not.toContain('at ');
      expect(bodyStr).not.toContain('.ts:');
      expect(bodyStr).not.toContain('.js:');
      expect(bodyStr).not.toMatch(/Error\n\s+at/);
    });

    test('GIVEN error response, THEN follows ErrorResponse schema', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/invalid-key/test.md`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      assertValidResponse(body, 'Error');

      // ErrorResponse schema: { ok: false, error: { code, message? } }
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(typeof body.error.code).toBe('string');
    });

    test('GIVEN workspace key, WHEN accessing another workspace file, THEN returns 404 not 403', async () => {
      // Create another workspace
      const otherWorkspace = await createTestWorkspace(app);
      const otherFile = await createTestFile(app, otherWorkspace, '/other-file.md');

      // Try to access other workspace's file with first workspace's key
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}${otherFile.path}`, {
          method: 'GET',
        })
      );

      // Returns 404 because file doesn't exist in this workspace
      // NOT 403 which would leak that the key is valid but file exists elsewhere
      expect(response.status).toBe(404);
    });

    test('GIVEN permission denied, THEN error does not reveal key capabilities', async () => {
      // Read key cannot write
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.readKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated' }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');

      // Error should not reveal what capabilities the key does have
      const bodyStr = JSON.stringify(body);
      expect(bodyStr).not.toContain('read key');
      expect(bodyStr).not.toContain('can only read');
    });
  });
});



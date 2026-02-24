import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createTestApp,
  resetKeysTestData,
  assertValidResponse,
  VALID_ADMIN_KEY,
  VALID_APPEND_KEY,
  VALID_READ_KEY,
  INVALID_KEY,
  EXPIRED_SCOPED_KEY,
  type TestApp,
} from './test-setup';

describe('POST /capabilities/check - Capabilities Check', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  describe('Successful Validation', () => {
    test('should return 200 for valid request', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY],
          }),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      assertValidResponse(body, 'CapabilitiesCheckResponse');
    });

    test('should validate single key', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.results).toHaveLength(1);
      expect(body.data.results[0].valid).toBe(true);
    });

    test('should validate multiple keys', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY, VALID_APPEND_KEY, VALID_READ_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.results).toHaveLength(3);
      expect(body.data.results[0].valid).toBe(true);
      expect(body.data.results[1].valid).toBe(true);
      expect(body.data.results[2].valid).toBe(true);
    });

    test('should return permission level for valid keys', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY, VALID_APPEND_KEY, VALID_READ_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.results[0].permission).toBe('write');
      expect(body.data.results[1].permission).toBe('append');
      expect(body.data.results[2].permission).toBe('read');
    });

    test('should return scope type and id', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.results[0].scope).toBeDefined();
      expect(body.data.results[0].scopeId).toBeDefined();
    });

    test('should return truncated key in response', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.results[0].key).toContain('...');
      expect(body.data.results[0].key.length).toBeLessThan(VALID_ADMIN_KEY.length);
    });

    test('should return valid: false for invalid keys', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: ['nonexistentkey12345678'],
          }),
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.results[0].valid).toBe(false);
      expect(body.data.results[0].error).toBe('NOT_FOUND');
    });

    test('should return valid: false for expired keys', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [EXPIRED_SCOPED_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.results[0].valid).toBe(false);
      expect(body.data.results[0].error).toBe('EXPIRED');
    });

    test('should return valid: false for revoked keys', async () => {
      const createResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
          }),
        })
      );

      const createBody = await createResponse.json();
      const keyId = createBody.data.id;
      const keyValue = createBody.data.key;

      await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys/${keyId}`, {
          method: 'DELETE',
        })
      );

      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [keyValue],
          }),
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.results[0].valid).toBe(false);
      expect(body.data.results[0].error).toBe('REVOKED');
    });

    test('should return error message for invalid keys', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [INVALID_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.results[0].valid).toBe(false);
      expect(body.data.results[0].error).toBeDefined();
    });

    test('should handle mixed valid and invalid keys', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY, 'nonexistentkey12345678', VALID_READ_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.results).toHaveLength(3);
      expect(body.data.results[0].valid).toBe(true);
      expect(body.data.results[1].valid).toBe(false);
      expect(body.data.results[2].valid).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should return 400 when keys is not an array', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: 'not-an-array',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should return 400 when keys array exceeds 100 items', async () => {
      const manyKeys = Array.from({ length: 101 }, (_, i) => `key${i}abcdefghijklmnopqr`);
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: manyKeys,
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should return 400 when keys field is missing', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should accept empty keys array', async () => {
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [],
          }),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.results).toHaveLength(0);
    });

    test('should accept exactly 100 keys', async () => {
      const keys = Array.from({ length: 100 }, (_, i) => `key${i}abcdefghijklmnopqr`);
      const response = await app.handle(
        new Request('http://localhost/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys,
          }),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.results).toHaveLength(100);
    });
  });
});


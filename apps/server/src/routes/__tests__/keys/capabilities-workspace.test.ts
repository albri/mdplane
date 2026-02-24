import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createTestApp,
  resetKeysTestData,
  assertValidResponse,
  VALID_ADMIN_KEY,
  VALID_APPEND_KEY,
  VALID_READ_KEY,
  EXPIRED_SCOPED_KEY,
  type TestApp,
} from './test-setup';

describe('POST /w/:key/capabilities/check - Workspace-Scoped Capabilities Check', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  describe('Successful Validation', () => {
    test('should return 200 for valid workspace key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
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
      assertValidResponse(body, 'CapabilitiesCheckInWorkspaceResponse');
    });

    test('should return extended info for keys in same workspace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.results[0].valid).toBe(true);
      expect(body.data.results[0].status).toBe('active');
    });

    test('should return permission level for valid workspace keys', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY, VALID_READ_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.results[0].permission).toBe('write');
      expect(body.data.results[1].permission).toBe('read');
    });

    test('should return status for keys in workspace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY, VALID_APPEND_KEY, VALID_READ_KEY],
          }),
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.results[0].status).toBe('active');
      expect(body.data.results[1].status).toBe('active');
      expect(body.data.results[2].status).toBe('active');
    });

    test('should allow read key to check capabilities', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_READ_KEY}/capabilities/check`, {
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
    });

    test('should allow append key to check capabilities', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_APPEND_KEY}/capabilities/check`, {
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
    });

    test('should return truncated key in response', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
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
  });

  describe('Invalid Keys', () => {
    test('should return valid: false for invalid keys', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
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

    test('should return status: expired for expired keys in workspace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
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
      expect(body.data.results[0].status).toBe('expired');
    });

    test('should return status: revoked for revoked keys in workspace', async () => {
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
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
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
      expect(body.data.results[0].status).toBe('revoked');
    });

    test('should handle mixed valid and invalid keys', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
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
      expect(body.data.results[0].status).toBe('active');
      expect(body.data.results[1].valid).toBe(false);
      expect(body.data.results[2].valid).toBe(true);
      expect(body.data.results[2].status).toBe('active');
    });
  });

  describe('Permission & Authorization', () => {
    test('should return 404 for invalid workspace key', async () => {
      const response = await app.handle(
        new Request('http://localhost/w/invalidkey123456789/capabilities/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY],
          }),
        })
      );

      expect(response.status).toBe(404);
    });

    test('should return 404 for expired workspace key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${EXPIRED_SCOPED_KEY}/capabilities/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: [VALID_ADMIN_KEY],
          }),
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('Validation', () => {
    test('should return 400 when keys is not an array', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
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
    });

    test('should return 400 when keys field is missing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should accept empty keys array', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/capabilities/check`, {
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
  });
});


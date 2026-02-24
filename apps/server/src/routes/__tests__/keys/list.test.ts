import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createTestApp,
  resetKeysTestData,
  assertValidResponse,
  VALID_ADMIN_KEY,
  VALID_APPEND_KEY,
  type TestApp,
} from './test-setup';

describe('GET /w/:adminKey/keys - List Keys', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  test('should return 200 with list of keys', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'GET',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('should match ScopedKeyListResponse schema', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, { method: 'GET' })
    );
    const body = await response.json();
    if (response.status === 200) {
      assertValidResponse(body, 'ScopedKeyListResponse');
    }
  });

  test('should return key metadata for each key', async () => {
    await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          boundAuthor: 'test-agent',
        }),
      })
    );

    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'GET',
      })
    );

    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);

    const key = body.data[0];
    expect(key.id).toBeDefined();
    expect(key.permission).toBeDefined();
    expect(key.createdAt).toBeDefined();
  });

  test('should include truncated key prefix, not full key', async () => {
    await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
        }),
      })
    );

    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'GET',
      })
    );

    const body = await response.json();
    const key = body.data[0];

    expect(key.key).toContain('...');
    expect(key.key.length).toBeLessThan(22);
  });

  test('should not return revoked keys', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'read',
        }),
      })
    );

    const createBody = await createResponse.json();
    const keyId = createBody.data.id;

    await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys/${keyId}`, {
        method: 'DELETE',
      })
    );

    const listResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'GET',
      })
    );

    const listBody = await listResponse.json();
    const foundRevokedKey = listBody.data.find((k: { id: string }) => k.id === keyId);
    expect(foundRevokedKey).toBeUndefined();
  });

  test('should include revoked keys when includeRevoked=true', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: 'read' }),
      })
    );

    const createBody = await createResponse.json();
    const keyId = createBody.data.id;

    await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys/${keyId}`, {
        method: 'DELETE',
      })
    );

    const listResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys?includeRevoked=true`, {
        method: 'GET',
      })
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    const foundRevokedKey = listBody.data.find((k: { id: string; revoked?: boolean }) => k.id === keyId);
    expect(foundRevokedKey).toBeDefined();
    expect(foundRevokedKey.revoked).toBe(true);
  });

  test('should return 400 for invalid includeRevoked value', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys?includeRevoked=maybe`, {
        method: 'GET',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  test('should include optional fields if they were set', async () => {
    const expiresAtValue = new Date(Date.now() + 86400 * 1000).toISOString();
    await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          paths: ['/docs/'],
          boundAuthor: 'agent-1',
          allowedTypes: ['task', 'claim'],
          expiresAt: expiresAtValue,
        }),
      })
    );

    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'GET',
      })
    );

    const body = await response.json();
    const keyWithOptionals = body.data.find(
      (k: { boundAuthor?: string }) => k.boundAuthor === 'agent-1'
    );

    expect(keyWithOptionals).toBeDefined();
    expect(keyWithOptionals.allowedTypes).toEqual(['task', 'claim']);
    expect(keyWithOptionals.expiresAt).toBeDefined();
  });

  test('should return 404 when using non-admin key (capability URL security)', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_APPEND_KEY}/keys`, {
        method: 'GET',
      })
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('PERMISSION_DENIED');
  });
});


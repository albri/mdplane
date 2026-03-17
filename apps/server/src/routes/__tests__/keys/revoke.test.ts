import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createTestApp,
  resetKeysTestData,
  VALID_ADMIN_KEY,
  VALID_APPEND_KEY,
  VALID_OTHER_ADMIN_KEY,
  type TestApp,
} from './test-setup';

describe('DELETE /w/:adminKey/keys/:keyId - Revoke Key', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  test('should return 200 on successful revocation', async () => {
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

    const revokeResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys/${keyId}`, {
        method: 'DELETE',
      })
    );

    const revokeBody = await revokeResponse.json();
    expect(revokeResponse.status).toBe(200);
    expect(revokeBody.ok).toBe(true);
  });

  test('should return id and revoked: true in response', async () => {
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

    const revokeResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys/${keyId}`, {
        method: 'DELETE',
      })
    );

    const revokeBody = await revokeResponse.json();
    expect(revokeBody.data.id).toBe(keyId);
    expect(revokeBody.data.revoked).toBe(true);
  });

  test('should make revoked key non-functional', async () => {
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

    const accessResponse = await app.handle(
      new Request(`http://localhost/a/${keyValue}/path/to/file.md`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          author: 'test-user',
          content: 'Test comment',
        }),
      })
    );

    expect(accessResponse.status).toBe(404);
    const accessBody = await accessResponse.json();
    expect(accessBody.ok).toBe(false);
    expect(accessBody.error.code).toBe('KEY_REVOKED');
  });

  test('should return 404 for non-existent key', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys/key_nonexistent123`, {
        method: 'DELETE',
      })
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  test('should return 404 when using non-admin key (capability URL security)', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_APPEND_KEY}/keys/key_somekey`, {
        method: 'DELETE',
      })
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('PERMISSION_DENIED');
  });

  test('should return 404 when revoking key from different workspace (cross-workspace isolation)', async () => {
    // Create a key in workspace A
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: 'read' }),
      })
    );
    const createBody = await createResponse.json();
    const keyId = createBody.data.id;

    // Try to revoke it using workspace B's admin key
    const revokeResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_OTHER_ADMIN_KEY}/keys/${keyId}`, {
        method: 'DELETE',
      })
    );

    expect(revokeResponse.status).toBe(404);
    const revokeBody = await revokeResponse.json();
    expect(revokeBody.ok).toBe(false);
    expect(revokeBody.error.code).toBe('KEY_NOT_FOUND');
  });
});


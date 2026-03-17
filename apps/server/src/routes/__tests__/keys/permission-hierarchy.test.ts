import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createTestApp,
  resetKeysTestData,
  VALID_ADMIN_KEY,
  type TestApp,
} from './test-setup';

describe('Permission Hierarchy', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  test('should allow admin to create read permission key', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'read',
        }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.permission).toBe('read');
  });

  test('should allow admin to create append permission key', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
        }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.permission).toBe('append');
  });

  test('should allow write key to create write permission key', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'write',
        }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.permission).toBe('write');
  });

  test('should not allow scoped key to create key with higher permission', async () => {
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
    const appendScopedKey = createBody.data.key;

    const escalateResponse = await app.handle(
      new Request(`http://localhost/w/${appendScopedKey}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'write',
        }),
      })
    );

    expect(escalateResponse.status).toBe(404);
    const escalateBody = await escalateResponse.json();
    expect(escalateBody.ok).toBe(false);
    expect(escalateBody.error.code).toBe('PERMISSION_DENIED');
  });

  test('should not allow read key to create any keys', async () => {
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
    const readScopedKey = createBody.data.key;

    const attemptResponse = await app.handle(
      new Request(`http://localhost/w/${readScopedKey}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'read',
        }),
      })
    );

    expect(attemptResponse.status).toBe(404);
    const attemptBody = await attemptResponse.json();
    expect(attemptBody.ok).toBe(false);
    expect(attemptBody.error.code).toBe('PERMISSION_DENIED');
  });
});


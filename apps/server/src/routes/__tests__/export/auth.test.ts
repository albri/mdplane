import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { exportRoute } from '../../export';
import { sqlite } from '../../../db';
import { hashKey } from '../../../core/capability-keys';
import {
  setupTestFixtures,
  VALID_EXPORT_KEY,
  VALID_READ_ONLY_KEY,
  EXPIRED_KEY,
  REVOKED_KEY,
  INVALID_KEY,
  MALFORMED_KEY,
  type TestApp,
} from './test-setup';

describe('Authentication & Authorization', () => {
  let app: TestApp;

  beforeAll(() => {
    app = new Elysia().use(exportRoute);
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  test('should return 401 when Authorization header is missing', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 with invalid API key', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${INVALID_KEY}`,
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 with malformed Bearer token', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${MALFORMED_KEY}`,
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 when API key scopes JSON is malformed', async () => {
    const keyHash = hashKey(VALID_EXPORT_KEY);
    sqlite.exec(`
      UPDATE api_keys
      SET scopes = 'not-json'
      WHERE key_hash = '${keyHash}'
    `);

    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 with expired API key', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${EXPIRED_KEY}`,
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 with revoked API key', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${REVOKED_KEY}`,
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 403 when API key missing export scope', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_READ_ONLY_KEY}`,
        },
      })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('PERMISSION_DENIED');
  });

  test('should return 200 with valid API key and export scope', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
  });
});


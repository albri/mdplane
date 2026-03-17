/**
 * Auth Endpoint Tests
 *
 * Verify auth endpoints respond (NOT full OAuth flow).
 * Uses mock OAuth sessions for testing without real providers.
 */

import { describe, test, expect } from 'bun:test';
import { apiRequest, bootstrap } from '../helpers/api-client';
import { createUserWithSession, getAuthHeaders } from '../helpers/mock-oauth';

describe('03 - Auth Endpoints', () => {
  test('GET /auth/me returns 401 without session', async () => {
    const response = await apiRequest('GET', '/auth/me');

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBeDefined();
  });

  test('GET /auth/me returns user when authenticated', async () => {
    const { sessionToken, email } = await createUserWithSession('test@integration.test');

    const response = await apiRequest('GET', '/auth/me', {
      headers: getAuthHeaders(sessionToken),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.id).toBeDefined();
    expect(data.data.email).toBe(email);
    expect(data.data.workspaces).toBeDefined();
    expect(Array.isArray(data.data.workspaces)).toBe(true);
  });

  test('GET /auth/me includes claimed workspace', async () => {
    const { sessionToken } = await createUserWithSession('claim@integration.test');
    const ws = await bootstrap();

    const claimRes = await apiRequest('POST', `/w/${ws.writeKey}/claim`, {
      headers: getAuthHeaders(sessionToken),
    });
    expect(claimRes.status).toBe(200);

    const meRes = await apiRequest('GET', '/auth/me', {
      headers: getAuthHeaders(sessionToken),
    });
    expect(meRes.status).toBe(200);
    const me = await meRes.json();

    expect(me.ok).toBe(true);
    expect(Array.isArray(me.data.workspaces)).toBe(true);
    expect(me.data.workspaces.some((w: { id: string }) => w.id === ws.workspaceId)).toBe(true);
  });

  test('GET /auth/me includes webUrl', async () => {
    const { sessionToken } = await createUserWithSession('control@integration.test');

    const response = await apiRequest('GET', '/auth/me', {
      headers: getAuthHeaders(sessionToken),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.webUrl).toBeDefined();
    expect(typeof data.data.webUrl).toBe('string');
    expect(data.data.webUrl).toContain('/control');
  });

  test('POST /auth/logout returns 200 with logged_out status', async () => {
    const { sessionToken } = await createUserWithSession('logout@integration.test');

    const response = await apiRequest('POST', '/auth/logout', {
      headers: getAuthHeaders(sessionToken),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.status).toBe('logged_out');
  });

  test('POST /auth/logout clears session cookie', async () => {
    const { sessionToken } = await createUserWithSession('logout-cookie@integration.test');

    const response = await apiRequest('POST', '/auth/logout', {
      headers: getAuthHeaders(sessionToken),
    });

    expect(response.status).toBe(200);

    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('Max-Age=0');
  });

  test('POST /auth/logout returns 401 without session', async () => {
    // Call logout without any session
    const response = await apiRequest('POST', '/auth/logout');

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });
});

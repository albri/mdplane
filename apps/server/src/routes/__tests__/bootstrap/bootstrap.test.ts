import { beforeAll, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { bootstrapRoute } from '../../bootstrap';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

const WORKSPACE_ID_PATTERN = /^ws_[A-Za-z0-9]{12,}$/;
const ROOT_KEY_PATTERN = /^[A-Za-z0-9]{22,}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function createBootstrapRequest(body: unknown): Request {
  return new Request('http://localhost/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /bootstrap', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(() => {
    app = new Elysia().use(bootstrapRoute);
  });

  test('returns 201 with required workspaceName', async () => {
    const response = await app.handle(createBootstrapRequest({ workspaceName: 'My Workspace' }));
    expect(response.status).toBe(201);
  });

  test('returns BootstrapResponse shape', async () => {
    const response = await app.handle(createBootstrapRequest({ workspaceName: 'My Workspace' }));
    const body = await response.json();

    expect(body.ok).toBe(true);
    assertValidResponse(body, 'BootstrapResponse');
    expect(body.data.workspaceId).toMatch(WORKSPACE_ID_PATTERN);
    expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
    expect(Number.isNaN(new Date(body.data.createdAt).getTime())).toBe(false);
  });

  test('returns read/append/write keys and API URLs', async () => {
    const response = await app.handle(createBootstrapRequest({ workspaceName: 'Key Custody' }));
    const body = await response.json();
    assertValidResponse(body, 'BootstrapResponse');

    expect(body.data.keys.read).toMatch(ROOT_KEY_PATTERN);
    expect(body.data.keys.append).toMatch(ROOT_KEY_PATTERN);
    expect(body.data.keys.write).toMatch(ROOT_KEY_PATTERN);
    expect(body.data.keys.read).not.toBe(body.data.keys.append);
    expect(body.data.keys.read).not.toBe(body.data.keys.write);
    expect(body.data.keys.append).not.toBe(body.data.keys.write);

    expect(body.data.urls.api.read).toMatch(/\/r\/[A-Za-z0-9]{22,}$/);
    expect(body.data.urls.api.append).toMatch(/\/a\/[A-Za-z0-9]{22,}$/);
    expect(body.data.urls.api.write).toMatch(/\/w\/[A-Za-z0-9]{22,}$/);
  });

  test('returns web read + claim URLs only (no append/write web URLs)', async () => {
    const response = await app.handle(createBootstrapRequest({ workspaceName: 'Runtime First' }));
    const body = await response.json();
    assertValidResponse(body, 'BootstrapResponse');

    expect(body.data.urls.web.read).toMatch(/\/r\/[A-Za-z0-9]{22,}$/);
    expect(body.data.urls.web.claim).toMatch(/\/claim\/[A-Za-z0-9]{22,}$/);
    expect(body.data.urls.web.append).toBeUndefined();
    expect(body.data.urls.web.write).toBeUndefined();
  });

  test('returns consistent keys across keys object and URLs', async () => {
    const response = await app.handle(createBootstrapRequest({ workspaceName: 'Consistency Check' }));
    const body = await response.json();
    assertValidResponse(body, 'BootstrapResponse');

    expect(body.data.urls.api.read).toContain(body.data.keys.read);
    expect(body.data.urls.api.append).toContain(body.data.keys.append);
    expect(body.data.urls.api.write).toContain(body.data.keys.write);
    expect(body.data.urls.web.read).toContain(body.data.keys.read);
    expect(body.data.urls.web.claim).toContain(body.data.keys.write);
  });

  test('includes X-Request-Id header', async () => {
    const response = await app.handle(createBootstrapRequest({ workspaceName: 'Header Check' }));
    expect(response.status).toBe(201);
    expect(response.headers.get('X-Request-Id')).toBeTruthy();
  });

  test('returns 400 for missing request body', async () => {
    const response = await app.handle(
      new Request('http://localhost/bootstrap', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  test('returns 400 for malformed JSON body', async () => {
    const response = await app.handle(
      new Request('http://localhost/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(body.error.message).toBe('Invalid JSON in request body');
  });

  test('returns 400 when workspaceName is missing', async () => {
    const response = await app.handle(createBootstrapRequest({}));
    expect(response.status).toBe(400);
  });

  test('returns 400 when workspaceName is empty', async () => {
    const response = await app.handle(createBootstrapRequest({ workspaceName: '' }));
    expect(response.status).toBe(400);
  });

  test('returns 400 when workspaceName is whitespace only', async () => {
    const response = await app.handle(createBootstrapRequest({ workspaceName: '   ' }));
    expect(response.status).toBe(400);
  });

  test('returns 400 when workspaceName exceeds 255 characters', async () => {
    const response = await app.handle(createBootstrapRequest({ workspaceName: 'a'.repeat(256) }));
    expect(response.status).toBe(400);
  });
});

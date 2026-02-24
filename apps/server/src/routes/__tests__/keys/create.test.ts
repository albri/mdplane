import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createTestApp,
  resetKeysTestData,
  assertValidResponse,
  VALID_ADMIN_KEY,
  VALID_APPEND_KEY,
  VALID_READ_KEY,
  SCOPED_READ_KEY_PATTERN,
  SCOPED_APPEND_KEY_PATTERN,
  SCOPED_WRITE_KEY_PATTERN,
  ISO_TIMESTAMP_PATTERN,
  EXPIRED_SCOPED_KEY,
  type TestApp,
} from './test-setup';

describe('POST /w/:adminKey/keys - Create Scoped Key', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  describe('Successful Creation', () => {
    test('should return 201 with new key for valid request', async () => {
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
      expect(body.ok).toBe(true);
    });

    test('should return ok: true in response', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'read',
          }),
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return key with r_ prefix for read permission', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'read',
          }),
        })
      );

      const body = await response.json();
      expect(body.data.key).toMatch(SCOPED_READ_KEY_PATTERN);
    });

    test('should return key with a_ prefix for append permission', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
          }),
        })
      );

      const body = await response.json();
      expect(body.data.key).toMatch(SCOPED_APPEND_KEY_PATTERN);
    });

    test('should return key with w_ prefix for write permission', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'write',
          }),
        })
      );

      const body = await response.json();
      expect(body.data.key).toMatch(SCOPED_WRITE_KEY_PATTERN);
    });

    test('should return key of at least 22 characters', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
          }),
        })
      );

      const body = await response.json();
      expect(body.data.key.length).toBeGreaterThanOrEqual(22);
    });

    test('should return permission in response', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
          }),
        })
      );

      const body = await response.json();
      expect(body.data.permission).toBe('append');
    });

    test('should return created timestamp', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
          }),
        })
      );

      const body = await response.json();
      expect(body.data.createdAt).toBeDefined();
      expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
    });

    test('should match ScopedKeyCreateResponse schema', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permission: 'read' }),
        })
      );
      const body = await response.json();
      if (response.status === 201) {
        assertValidResponse(body, 'ScopedKeyCreateResponse');
      }
    });
  });

  describe('Optional Fields', () => {
    test('should store paths when provided', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
            paths: ['/docs/'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.key).toBeDefined();
    });

    test('should store boundAuthor when provided', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
            boundAuthor: 'agent-1',
          }),
        })
      );

      const body = await response.json();
      expect(body.data.boundAuthor).toBe('agent-1');
    });

    test('should store allowedTypes array when provided', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
            allowedTypes: ['task', 'claim'],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.allowedTypes).toEqual(['task', 'claim']);
    });

    test('should store expiresAt when provided', async () => {
      const expiresAtValue = new Date(Date.now() + 86400 * 1000).toISOString();
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
            expiresAt: expiresAtValue,
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.expiresAt).toBeDefined();
      expect(body.data.expiresAt).toMatch(ISO_TIMESTAMP_PATTERN);
    });

    test('should store all optional fields together', async () => {
      const expiresAtValue = new Date(Date.now() + 86400 * 1000).toISOString();
      const response = await app.handle(
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

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.permission).toBe('append');
      expect(body.data.boundAuthor).toBe('agent-1');
      expect(body.data.allowedTypes).toEqual(['task', 'claim']);
      expect(body.data.expiresAt).toBeDefined();
    });
  });

  describe('Validation - Create Key', () => {
    test('should return 400 when permission is missing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
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

    test('should return 400 for invalid permission value', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'superadmin',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should return 404 when using read key to create keys (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_READ_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'read',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should return 404 when using append key to create keys (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_APPEND_KEY}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'read',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });
  });
});

describe('Scope Path Enforcement', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  test('should allow access to scopePath when using scoped key', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          scopePath: '/docs/',
        }),
      })
    );

    const createBody = await createResponse.json();
    const scopedKey = createBody.data.key;

    const accessResponse = await app.handle(
      new Request(`http://localhost/a/${scopedKey}/docs/readme.md`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          author: 'test-user',
          content: 'Test comment',
        }),
      })
    );

    expect(accessResponse.status).not.toBe(403);
  });

  test('should allow access to child paths of scopePath', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          scopePath: '/docs/',
        }),
      })
    );

    const createBody = await createResponse.json();
    const scopedKey = createBody.data.key;

    const accessResponse = await app.handle(
      new Request(`http://localhost/a/${scopedKey}/docs/guides/getting-started.md`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          author: 'test-user',
          content: 'Test comment',
        }),
      })
    );

    expect(accessResponse.status).not.toBe(403);
  });

  test('should create scoped key with paths restriction', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          paths: ['/docs/'],
        }),
      })
    );

    expect(createResponse.status).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody.ok).toBe(true);
    expect(createBody.data.key).toBeDefined();
  });

  test('should create scoped key with nested paths restriction', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          paths: ['/docs/guides/'],
        }),
      })
    );

    expect(createResponse.status).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody.ok).toBe(true);
    expect(createBody.data.key).toBeDefined();
  });
});

describe('Bound Author Enforcement', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  test('should accept appends with correct boundAuthor', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          boundAuthor: 'agent-1',
        }),
      })
    );

    const createBody = await createResponse.json();
    const scopedKey = createBody.data.key;

    const appendResponse = await app.handle(
      new Request(`http://localhost/a/${scopedKey}/path/to/file.md`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          author: 'agent-1',
          content: 'Comment from agent-1',
        }),
      })
    );

    expect(appendResponse.status).toBe(201);
    const appendBody = await appendResponse.json();
    expect(appendBody.ok).toBe(true);
  });

  test('should reject appends with wrong author when boundAuthor is set', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          boundAuthor: 'agent-1',
        }),
      })
    );

    const createBody = await createResponse.json();
    const scopedKey = createBody.data.key;

    const appendResponse = await app.handle(
      new Request(`http://localhost/a/${scopedKey}/path/to/file.md`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          author: 'agent-2',
          content: 'Comment from agent-2',
        }),
      })
    );

    expect(appendResponse.status).toBe(400);
    const body = await appendResponse.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('AUTHOR_MISMATCH');
  });
});

describe('Allowed Types Enforcement', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  test('should accept appends with allowed type', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          allowedTypes: ['task', 'claim'],
        }),
      })
    );

    const createBody = await createResponse.json();
    const scopedKey = createBody.data.key;

    const appendResponse = await app.handle(
      new Request(`http://localhost/a/${scopedKey}/path/to/file.md`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'task',
          author: 'test-user',
          content: 'A new task',
        }),
      })
    );

    expect(appendResponse.status).toBe(201);
    const appendBody = await appendResponse.json();
    expect(appendBody.ok).toBe(true);
  });

  test('should reject appends with disallowed type', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          allowedTypes: ['task', 'claim'],
        }),
      })
    );

    const createBody = await createResponse.json();
    const scopedKey = createBody.data.key;

    const appendResponse = await app.handle(
      new Request(`http://localhost/a/${scopedKey}/path/to/file.md`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          author: 'test-user',
          content: 'A comment',
        }),
      })
    );

    expect(appendResponse.status).toBe(400);
    const body = await appendResponse.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('TYPE_NOT_ALLOWED');
  });
});

describe('Key Expiry', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetKeysTestData();
  });

  test('should set expiresAt when provided as ISO timestamp', async () => {
    const expiresAtValue = new Date(Date.now() + 3600 * 1000).toISOString();

    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
          expiresAt: expiresAtValue,
        }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.expiresAt).toBeDefined();
    expect(body.data.expiresAt).toMatch(ISO_TIMESTAMP_PATTERN);
  });

  test('should return 404 KEY_EXPIRED when using expired key', async () => {
    const accessResponse = await app.handle(
      new Request(`http://localhost/a/${EXPIRED_SCOPED_KEY}/path/to/file.md`, {
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
    const body = await accessResponse.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('KEY_EXPIRED');
  });

  test('should not include expiresAt when expiresInSeconds not provided', async () => {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission: 'append',
        }),
      })
    );

    const body = await response.json();
    expect(body.data.expiresAt).toBeUndefined();
  });
});


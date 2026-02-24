import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createFoldersTestApp,
  resetTestFolders,
  sqlite,
  assertValidResponse,
  VALID_READ_KEY,
  VALID_WRITE_KEY,
  VALID_APPEND_KEY,
  EXPIRED_KEY,
  REVOKED_KEY,
  INVALID_KEY,
  type TestApp,
} from './test-setup';

describe('Folder Claims', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createFoldersTestApp();
  });

  beforeEach(() => {
    resetTestFolders();
  });

  function setupFolderWithClaims(): void {
    const now = new Date().toISOString();
    const futureExpiry = new Date(Date.now() + 3600000).toISOString();
    const pastExpiry = new Date(Date.now() - 3600000).toISOString();

    const fileId = 'file_claims_test_1';
    const filePath = '/test-claims/file1.md';
    sqlite.exec(`DELETE FROM appends WHERE file_id = '${fileId}'`);
    sqlite.exec(`DELETE FROM files WHERE id = '${fileId}'`);
    sqlite.exec(`
      INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
      VALUES ('${fileId}', 'ws_test_folders', '${filePath}', '# Test File', '${now}', '${now}')
    `);

    sqlite.exec(`
      INSERT INTO appends (id, file_id, append_id, author, type, status, created_at, content_preview)
      VALUES ('append_claims_task_1', '${fileId}', 'a1', 'orchestrator', 'task', 'open', '${now}', 'Test task content')
    `);

    sqlite.exec(`
      INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
      VALUES ('append_claims_claim_1', '${fileId}', 'a2', 'agent-1', 'claim', 'a1', 'active', '${futureExpiry}', '${now}')
    `);

    sqlite.exec(`
      INSERT INTO appends (id, file_id, append_id, author, type, status, created_at, content_preview)
      VALUES ('append_claims_task_2', '${fileId}', 'a3', 'orchestrator', 'task', 'open', '${now}', 'Another task content')
    `);

    sqlite.exec(`
      INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
      VALUES ('append_claims_claim_2', '${fileId}', 'a4', 'agent-2', 'claim', 'a3', 'active', '${pastExpiry}', '${now}')
    `);

    const fileId2 = 'file_claims_test_2';
    const filePath2 = '/test-claims/file2.md';
    sqlite.exec(`DELETE FROM appends WHERE file_id = '${fileId2}'`);
    sqlite.exec(`DELETE FROM files WHERE id = '${fileId2}'`);
    sqlite.exec(`
      INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
      VALUES ('${fileId2}', 'ws_test_folders', '${filePath2}', '# Test File 2', '${now}', '${now}')
    `);

    sqlite.exec(`
      INSERT INTO appends (id, file_id, append_id, author, type, status, created_at, content_preview)
      VALUES ('append_claims_task_3', '${fileId2}', 'a1', 'orchestrator', 'task', 'open', '${now}', 'Task in file 2')
    `);

    sqlite.exec(`
      INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
      VALUES ('append_claims_claim_3', '${fileId2}', 'a2', 'agent-1', 'claim', 'a1', 'active', '${futureExpiry}', '${now}')
    `);
  }

  describe('GET /a/:key/folders/:path/claims - List Folder Claims', () => {
    describe('Success Cases', () => {
      test('should return 200 with empty claims for folder with no claims', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.claims).toBeDefined();
        expect(Array.isArray(body.data.claims)).toBe(true);
        expect(body.data.count).toBeDefined();
        expect(typeof body.data.count).toBe('number');
      });

      test('should return 200 with claims for folder with active claims', async () => {
        setupFolderWithClaims();

        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/test-claims/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(Array.isArray(body.data.claims)).toBe(true);
        expect(body.data.claims.length).toBeGreaterThan(0);
        expect(body.data.count).toBe(body.data.claims.length);
        assertValidResponse(body, 'ListFolderClaimsResponse');
      });

      test('should filter claims by author', async () => {
        setupFolderWithClaims();

        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/test-claims/claims?author=agent-1`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.claims.length).toBe(2);
        body.data.claims.forEach((claim: { file: { path: string } }) => {
          expect(claim.file).toBeDefined();
          expect(claim.file.path).toBeDefined();
        });
      });

      test('should return proper claim structure', async () => {
        setupFolderWithClaims();

        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/test-claims/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();

        if (body.data.claims.length > 0) {
          const claim = body.data.claims[0];
          expect(claim.taskId).toBeDefined();
          expect(claim.claimId).toBeDefined();
          expect(claim.file).toBeDefined();
          expect(claim.file.id).toBeDefined();
          expect(claim.file.path).toBeDefined();
          expect(claim.taskContent).toBeDefined();
          expect(claim.status).toBeDefined();
          expect(['active', 'expired']).toContain(claim.status);
          expect(claim.expiresAt).toBeDefined();
          expect(typeof claim.expiresInSeconds).toBe('number');
        }
      });

      test('should correctly identify expired claims', async () => {
        setupFolderWithClaims();

        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/test-claims/claims?author=agent-2`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.data.claims.length).toBe(1);
        expect(body.data.claims[0].status).toBe('expired');
        expect(body.data.claims[0].expiresInSeconds).toBe(0);
      });

      test('should work with write key as well', async () => {
        setupFolderWithClaims();

        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_WRITE_KEY}/folders/test-claims/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });

    describe('Error Cases', () => {
      test('should return 404 for invalid key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${INVALID_KEY}/folders/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for read-only key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_READ_KEY}/folders/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('PERMISSION_DENIED');
        expect(body.error.message).toBe('Insufficient permissions for this operation');
      });

      test('should return 404 for expired key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${EXPIRED_KEY}/folders/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${REVOKED_KEY}/folders/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 400 for path traversal', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/${encodeURIComponent('../etc')}/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });
    });

    describe('Response Format', () => {
      test('should return proper response structure', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/claims`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('ok', true);
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('claims');
        expect(body.data).toHaveProperty('count');
      });

      test('should return JSON content-type', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/claims`, {
            method: 'GET',
          })
        );
        const contentType = response.headers.get('Content-Type');
        expect(contentType).toContain('application/json');
      });
    });
  });
});


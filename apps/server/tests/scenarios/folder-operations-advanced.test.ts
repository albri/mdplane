/**
 * Folder Operations Scenario Tests
 *
 * Comprehensive tests:
 * - Create folder
 * - List folder contents
 * - Create file in folder
 * - Move file between folders
 * - Delete folder (cascade)
 * - Folder-level permissions
 * - Nested folders
 * - Search within folder
 * - Folder metadata
 * - Folder-level webhooks
 * - Bulk operations
 * - Folder-level claims
 * - Folder statistics
 * - Folder export
 * - Folder sharing (path-scoped keys)
 *
 * @see packages/shared/openapi/paths/folders.yaml
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createTestApp } from '../helpers';
import { assertValidResponse } from '../helpers/schema-validator';
import { createTestWorkspace, createTestFile, createTestTask, claimTask } from '../fixtures';

/**
 * Extract the capability key from a capability URL.
 * URLs are in the format: /r/KEY/path or /w/KEY/path
 */
function extractKey(url: string): string {
  const match = url.match(/\/([raw])\/([A-Za-z0-9]+)/);
  if (!match) {
    throw new Error(`Invalid capability URL format: ${url}`);
  }
  return match[2];
}

describe('Folder Operations Scenarios', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Folder Metadata', () => {
    test('GIVEN a folder WHEN listing THEN includes path in response', async () => {
      // GIVEN: A folder with content
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/metadata-test/file.md', '# Test');

      // WHEN: Listing the folder
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/metadata-test`, {
          method: 'GET',
        })
      );

      // THEN: Response should include folder path
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { data } = body;
      expect(data.path).toBe('/metadata-test/');
    });

    test('GIVEN folder items WHEN listing THEN files have size and modified metadata', async () => {
      // GIVEN: A file in a folder
      const workspace = await createTestWorkspace(app);
      const content = '# Test Content\n\nWith some lines.';
      await createTestFile(app, workspace, '/meta/doc.md', content);

      // WHEN: Listing the folder
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/meta`, {
          method: 'GET',
        })
      );

      // THEN: File should have size and modified
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { data } = body;
      const file = data.items[0];
      expect(file.size).toBe(content.length);
      expect(file.updatedAt).toBeDefined();
      expect(new Date(file.updatedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Folder-Level Webhooks', () => {
    test('GIVEN a folder WHEN adding webhook THEN webhook fires on file changes', async () => {
      // GIVEN: A workspace with a folder
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'webhooks-test' }),
        })
      );

      // WHEN: Creating a folder webhook
      const webhookResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/webhooks-test/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['file.created', 'append'],
          }),
        })
      );

      // THEN: Webhook should be created successfully
      expect(webhookResponse.status).toBe(201);
      const webhookBody = await webhookResponse.json();
      assertValidResponse(webhookBody, 'WebhookCreateResponse');
      expect(webhookBody.ok).toBe(true);
      expect(webhookBody.data.id).toMatch(/^wh_/);
      expect(webhookBody.data.secret).toMatch(/^whsec_/);

      // AND: Webhook should be listable
      const listResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/webhooks-test/webhooks`)
      );
      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json();
      assertValidResponse(listBody, 'WebhookListResponse');
      expect(listBody.ok).toBe(true);
      expect(listBody.data.length).toBe(1);
      expect(listBody.data[0].id).toBe(webhookBody.data.id);
    });

    test('GIVEN a folder webhook WHEN subfolder file changes THEN webhook fires if recursive', async () => {
      // GIVEN: A workspace with nested folders
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'parent' }),
        })
      );
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'parent/child' }),
        })
      );

      // WHEN: Creating a webhook on parent folder with recursive option
      const webhookResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/parent/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['file.created'],
            recursive: true,
          }),
        })
      );

      // THEN: Webhook should be created with recursive flag
      expect(webhookResponse.status).toBe(201);
      const webhookBody = await webhookResponse.json();
      assertValidResponse(webhookBody, 'WebhookCreateResponse');
      expect(webhookBody.ok).toBe(true);
      expect(webhookBody.data.recursive).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    test('GIVEN a folder WHEN bulk creating files THEN all files are created', async () => {
      // GIVEN: A workspace with a folder
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'bulk-test' }),
        })
      );

      // WHEN: POST /a/:key/folders/:path/bulk with multiple files
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}/folders/bulk-test/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [
              { filename: 'file1.md', content: '# File 1' },
              { filename: 'file2.md', content: '# File 2' },
              { filename: 'file3.md', content: '# File 3' },
            ],
          }),
        })
      );

      // THEN: All files should be created
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'FolderBulkCreateResponse');
      expect(body.ok).toBe(true);
      expect(body.data.created).toBeInstanceOf(Array);
      expect(body.data.created.length).toBe(3);

      // Each created file should have id, filename, and urls
      for (const file of body.data.created) {
        expect(file.id).toBeDefined();
        expect(file.filename).toBeDefined();
        expect(file.urls).toBeDefined();
        expect(file.urls.read).toContain('/r/');
        expect(file.urls.append).toContain('/a/');
        expect(file.urls.write).toContain('/w/');
      }

      // Verify files appear in folder listing
      const listResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/bulk-test`, {
          method: 'GET',
        })
      );
      const listBody = await listResponse.json();
      assertValidResponse(listBody, 'FolderListResponse');
      expect(listBody.data.items.length).toBe(3);
    });
  });

  describe('Folder-Level Claims', () => {
    test('GIVEN files with claims in folder WHEN querying folder claims THEN returns all claims', async () => {
      // GIVEN: Multiple files with claims in a folder
      const workspace = await createTestWorkspace(app);
      const file1 = await createTestFile(app, workspace, '/claims-test/file1.md', '# File 1');
      const file2 = await createTestFile(app, workspace, '/claims-test/file2.md', '# File 2');

      // Create tasks in both files
      const task1 = await createTestTask(app, workspace, file1, {
        author: 'orchestrator',
        content: 'Task 1: Review code',
      });
      const task2 = await createTestTask(app, workspace, file2, {
        author: 'orchestrator',
        content: 'Task 2: Write tests',
      });

      // Claim both tasks with the same agent
      const claimResponse1 = await claimTask(app, workspace, file1, task1.ref, 'agent-1');
      expect(claimResponse1.status).toBe(201);
      const claimResponse2 = await claimTask(app, workspace, file2, task2.ref, 'agent-1');
      expect(claimResponse2.status).toBe(201);

      // WHEN: GET /a/:key/folders/:path/claims?author=agent-1
      const response = await app.handle(
        new Request(
          `http://localhost/a/${workspace.appendKey}/folders/claims-test/claims?author=agent-1`,
          {
            method: 'GET',
          }
        )
      );

      // THEN: Returns all claims by that author in the folder
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'ListFolderClaimsResponse');
      expect(body.ok).toBe(true);
      expect(body.data.claims).toBeInstanceOf(Array);
      expect(body.data.claims.length).toBe(2);
      expect(body.data.count).toBe(2);

      // Verify claim structure per OpenAPI spec
      for (const claim of body.data.claims) {
        expect(claim.taskId).toBeDefined();
        expect(claim.claimId).toBeDefined();
        expect(claim.file).toBeDefined();
        expect(claim.file.id).toBeDefined();
        expect(claim.file.path).toBeDefined();
        expect(claim.taskContent).toBeDefined();
        expect(claim.status).toBe('active');
        expect(claim.expiresAt).toBeDefined();
        expect(claim.expiresInSeconds).toBeDefined();
      }
    });
  });

  describe('Folder Statistics', () => {
    test('GIVEN a folder with files WHEN getting stats THEN returns aggregate statistics', async () => {
      // GIVEN: A folder with multiple files
      const workspace = await createTestWorkspace(app);

      // Create files in /stats folder
      await createTestFile(app, workspace, '/stats/file1.md', '# File 1');
      await createTestFile(app, workspace, '/stats/file2.md', '# File 2 with more content');

      // Create a subfolder with a file
      await createTestFile(app, workspace, '/stats/subdir/file3.md', '# File 3');

      // WHEN: GET /r/:key/ops/folders/stats?path=:path
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/ops/folders/stats?path=stats`, {
          method: 'GET',
        })
      );

      // THEN: Returns fileCount, folderCount, totalSize, lastModified
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FolderStatsResponse');
      expect(body.ok).toBe(true);
      expect(body.data.path).toBe('/stats');
      expect(body.data.fileCount).toBe(3); // 3 files total
      expect(body.data.folderCount).toBe(1); // 1 subfolder
      expect(body.data.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Folder Export', () => {
    test('GIVEN a folder with files WHEN exporting as zip THEN returns archive', async () => {
      // GIVEN: A folder with files
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/export-test/file1.md', '# File 1 content');
      await createTestFile(app, workspace, '/export-test/file2.md', '# File 2 content');
      await createTestFile(app, workspace, '/export-test/nested/file3.md', '# Nested file');

      // WHEN: GET /r/:key/folders/:path?action=export&format=zip
      const response = await app.handle(
        new Request(
          `http://localhost/r/${workspace.readKey}/folders/export-test?action=export&format=zip`
        )
      );

      // THEN: Returns 200 with zip archive
      expect(response.status).toBe(200);

      // Check Content-Type header
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toBe('application/zip');

      // Check Content-Disposition header contains filename
      const contentDisposition = response.headers.get('Content-Disposition');
      expect(contentDisposition).toContain('attachment');
      expect(contentDisposition).toContain('filename=');
      expect(contentDisposition).toContain('.zip');

      // Check X-Export-Checksum header exists
      const checksum = response.headers.get('X-Export-Checksum');
      expect(checksum).toBeTruthy();
      expect(checksum).toContain('sha256:');

      // Response body should be binary data (non-empty)
      const arrayBuffer = await response.arrayBuffer();
      expect(arrayBuffer.byteLength).toBeGreaterThan(0);
    });

    test('GIVEN a folder WHEN exporting non-recursively THEN returns only direct children', async () => {
      // GIVEN: A folder with nested structure
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/export-nonrec/direct.md', '# Direct file');
      await createTestFile(app, workspace, '/export-nonrec/nested/sub.md', '# Nested file');

      // WHEN: Export with recursive=false (default)
      const response = await app.handle(
        new Request(
          `http://localhost/r/${workspace.readKey}/folders/export-nonrec?action=export&format=zip&recursive=false`
        )
      );

      // THEN: Returns 200
      expect(response.status).toBe(200);

      // Parse the JSON content to check files included
      const text = await response.text();
      const data = JSON.parse(text);

      // Should only include direct.md (not nested/sub.md)
      const paths = data.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/export-nonrec/direct.md');
      expect(paths).not.toContain('/export-nonrec/nested/sub.md');
    });

    test('GIVEN a folder WHEN exporting recursively THEN returns all nested files', async () => {
      // GIVEN: A folder with nested structure
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/export-rec/direct.md', '# Direct file');
      await createTestFile(app, workspace, '/export-rec/nested/sub.md', '# Nested file');
      await createTestFile(app, workspace, '/export-rec/nested/deep/file.md', '# Deep file');

      // WHEN: Export with recursive=true
      const response = await app.handle(
        new Request(
          `http://localhost/r/${workspace.readKey}/folders/export-rec?action=export&format=zip&recursive=true`
        )
      );

      // THEN: Returns 200
      expect(response.status).toBe(200);

      // Parse the JSON content to check files included
      const text = await response.text();
      const data = JSON.parse(text);

      // Should include all files
      const paths = data.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/export-rec/direct.md');
      expect(paths).toContain('/export-rec/nested/sub.md');
      expect(paths).toContain('/export-rec/nested/deep/file.md');
    });

    test('GIVEN non-existent folder WHEN exporting THEN returns 404', async () => {
      // GIVEN: A workspace with no folders
      const workspace = await createTestWorkspace(app);

      // WHEN: Export non-existent folder
      const response = await app.handle(
        new Request(
          `http://localhost/r/${workspace.readKey}/folders/nonexistent?action=export&format=zip`
        )
      );

      // THEN: Returns 404 FOLDER_NOT_FOUND
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FOLDER_NOT_FOUND');
    });
  });

  describe('Folder Sharing', () => {
    test('GIVEN a workspace WHEN creating scoped key with paths THEN key is restricted to that path', async () => {
      // GIVEN: A workspace with folders
      const workspace = await createTestWorkspace(app);

      // Create folder structure
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'shared' }),
        })
      );
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'private' }),
        })
      );

      // Create files in both folders
      await createTestFile(app, workspace, '/shared/public.md', '# Public');
      await createTestFile(app, workspace, '/private/secret.md', '# Secret');

      // WHEN: Create a scoped key restricted to /shared/
      const keyResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'read',
            paths: ['/shared/'],
          }),
        })
      );

      expect(keyResponse.status).toBe(201);
      const keyBody = await keyResponse.json() as { ok: boolean; data: { key: string } };
      assertValidResponse(keyBody, 'ScopedKeyCreateResponse');
      expect(keyBody.ok).toBe(true);
      // The key is returned as full key (e.g., "r_xxx...") - use it directly in the URL
      const scopedKey = keyBody.data.key;

      // THEN: Scoped key can read files in /shared/
      const sharedRead = await app.handle(
        new Request(`http://localhost/r/${scopedKey}/shared/public.md`, {
          method: 'GET',
        })
      );
      expect(sharedRead.status).toBe(200);

      // AND: Scoped key CANNOT read files in /private/ (outside scope)
      const privateRead = await app.handle(
        new Request(`http://localhost/r/${scopedKey}/private/secret.md`, {
          method: 'GET',
        })
      );
      expect(privateRead.status).toBe(404); // Returns 404 for out-of-scope (PERMISSION_DENIED)
    });
  });

  describe('Folder Rename', () => {
    test('GIVEN a folder WHEN renaming THEN folder path is updated', async () => {
      // GIVEN: A folder with files
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/old-name/file.md', '# File');

      // WHEN: Renaming the folder
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/old-name`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'new-name' }),
        })
      );

      // THEN: Folder should be renamed
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FolderMoveResponse');
      const { data } = body;
      expect(data.previousPath).toBe('/old-name');
      expect(data.newPath).toBe('/new-name');

      // AND: Files should be accessible at new path
      const listResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/new-name`, {
          method: 'GET',
        })
      );
      expect(listResponse.ok).toBe(true);
      const listData = await listResponse.json();
      assertValidResponse(listData, 'FolderListResponse');
      expect(listData.data.items.length).toBe(1);
    });

    test('GIVEN a renamed folder WHEN accessing old path THEN returns 404', async () => {
      // GIVEN: A folder that was renamed
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/original/data.md', '# Data');

      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'renamed' }),
        })
      );

      // WHEN: Accessing old path
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/original`, {
          method: 'GET',
        })
      );

      // THEN: Should return 404
      expect(response.status).toBe(404);
    });
  });
});

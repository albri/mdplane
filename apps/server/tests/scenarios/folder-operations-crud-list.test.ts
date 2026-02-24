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

  describe('Create Folder', () => {
    test('GIVEN a workspace WHEN creating a folder with POST /w/:key/folders THEN folder is created with metadata', async () => {
      // GIVEN: A bootstrapped workspace
      const workspace = await createTestWorkspace(app);

      // WHEN: Creating a folder via POST
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'test-folder' }),
        })
      );

      // THEN: Response should be 201 with folder metadata
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'FolderCreateResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.path).toBe('/test-folder');
      expect(data.urls).toBeDefined();
      expect(data.urls.read).toContain('/r/');
      expect(data.urls.append).toContain('/a/');
      expect(data.urls.write).toContain('/w/');
      expect(data.createdAt).toBeDefined();
    });

    test('GIVEN a workspace WHEN creating a folder with parent path THEN folder is nested correctly', async () => {
      // GIVEN: A workspace with a parent folder
      const workspace = await createTestWorkspace(app);

      // Create parent folder first
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'parent' }),
        })
      );

      // WHEN: Creating a nested folder
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'child', path: '/parent' }),
        })
      );

      // THEN: Nested folder should be created
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'FolderCreateResponse');
      const { data } = body;
      expect(data.path).toBe('/parent/child');
    });

    test('GIVEN an existing folder WHEN creating a folder with same name THEN returns 409 conflict', async () => {
      // GIVEN: A workspace with an existing folder
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'duplicate' }),
        })
      );

      // WHEN: Creating folder with same name
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'duplicate' }),
        })
      );

      // THEN: Should return 409 conflict
      expect(response.status).toBe(409);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      const { ok, error } = body;
      expect(ok).toBe(false);
      expect(error.code).toBe('FOLDER_ALREADY_EXISTS');
    });

    test('GIVEN a read key WHEN creating a folder THEN returns 404 not found', async () => {
      // GIVEN: A workspace with only read access
      const workspace = await createTestWorkspace(app);

      // WHEN: Attempting to create folder with read key
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.readKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'forbidden' }),
        })
      );

      // THEN: Should return 404
      expect(response.status).toBe(404);
    });
  });

  describe('List Folder Contents', () => {
    test('GIVEN a folder with files WHEN listing contents THEN returns file list with metadata', async () => {
      // GIVEN: A workspace with a folder containing files
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/docs/readme.md', '# Readme');
      await createTestFile(app, workspace, '/docs/guide.md', '# Guide');

      // WHEN: Listing folder contents
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/docs`, {
          method: 'GET',
        })
      );

      // THEN: Should return file list with metadata
      expect(response.ok).toBe(true);
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.path).toBe('/docs/');
      expect(data.items).toBeInstanceOf(Array);
      expect(data.items.length).toBe(2);

      const fileNames = data.items.map((item: { name: string }) => item.name);
      expect(fileNames).toContain('readme.md');
      expect(fileNames).toContain('guide.md');
    });

    test('GIVEN a folder with files WHEN listing contents THEN items include size and modified', async () => {
      // GIVEN: A workspace with a folder containing a file
      const workspace = await createTestWorkspace(app);
      const content = '# Test File\n\nThis is test content.';
      await createTestFile(app, workspace, '/data/test.md', content);

      // WHEN: Listing folder contents
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/data`, {
          method: 'GET',
        })
      );

      // THEN: File items should include size and modified
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { data } = body;
      const file = data.items.find((item: { name: string }) => item.name === 'test.md');
      expect(file).toBeDefined();
      expect(file.type).toBe('file');
      expect(file.size).toBe(content.length);
      expect(file.updatedAt).toBeDefined();
    });

    test('GIVEN an empty folder WHEN listing contents THEN returns empty array', async () => {
      // GIVEN: A workspace with an empty folder
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'empty-folder' }),
        })
      );

      // WHEN: Listing the empty folder
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/empty-folder`, {
          method: 'GET',
        })
      );

      // THEN: Should return empty items array
      expect(response.ok).toBe(true);
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { data } = body;
      expect(data.items).toBeInstanceOf(Array);
      expect(data.items.length).toBe(0);
    });

    test('GIVEN a non-existent folder WHEN listing contents THEN returns 404', async () => {
      // GIVEN: A workspace with no such folder
      const workspace = await createTestWorkspace(app);

      // WHEN: Listing a non-existent folder
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/nonexistent`, {
          method: 'GET',
        })
      );

      // THEN: Should return 404
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      const { ok, error } = body;
      expect(ok).toBe(false);
      expect(error.code).toBe('FOLDER_NOT_FOUND');
    });
  });

  describe('Create File in Folder', () => {
    test('GIVEN a folder WHEN creating file with POST /a/:key/folders/:path/files THEN file is created', async () => {
      // GIVEN: A workspace with a folder
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'docs' }),
        })
      );

      // WHEN: Creating a file in the folder using POST /a/:key/folders/:path/files
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}/folders/docs/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: 'readme.md', content: '# Readme' }),
        })
      );

      // THEN: File should be created successfully
      expect(response.status).toBe(201);
      const body = await response.json() as { ok: boolean; data: { id: string; filename: string; path: string; urls: { read: string } } };
      assertValidResponse(body, 'CreateFileResponse');
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.filename).toBe('readme.md');
      expect(body.data.path).toBe('/docs/readme.md');
      expect(body.data.urls.read).toBeDefined();
    });

    test('GIVEN a folder WHEN creating file with PUT /w/:key/:path THEN file is created', async () => {
      // GIVEN: A workspace with a folder
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'projects' }),
        })
      );

      // WHEN: Creating a file in the folder using PUT
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/projects/tasks.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Project Tasks' }),
        })
      );

      // THEN: File should be created successfully
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'FileUpdateResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.id).toBeDefined();
    });

    test('GIVEN a folder WHEN file is created THEN it appears in folder listing', async () => {
      // GIVEN: A workspace with a folder
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'notes' }),
        })
      );

      // Create a file in the folder using PUT
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/notes/meeting.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Meeting Notes' }),
        })
      );

      // WHEN: Listing the folder
      const listResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/notes`, {
          method: 'GET',
        })
      );

      // THEN: File should appear in listing
      const listBody = await listResponse.json();
      assertValidResponse(listBody, 'FolderListResponse');
      const { data } = listBody;
      const file = data.items.find((item: { name: string }) => item.name === 'meeting.md');
      expect(file).toBeDefined();
      expect(file.type).toBe('file');
    });

    test('GIVEN a folder with existing file WHEN creating file with same name via PUT THEN returns 200 (update)', async () => {
      // GIVEN: A folder with an existing file
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/assets/logo.md', '# Logo');

      // WHEN: Creating file with same name via PUT (this updates the file)
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/assets/logo.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated Logo' }),
        })
      );

      // THEN: Should return 200 (update, not create)
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileUpdateResponse');
      const { ok } = body;
      expect(ok).toBe(true);
    });
  });

});

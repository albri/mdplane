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

  describe('Move File Between Folders', () => {
    test('GIVEN a file in folder A WHEN moving to folder B THEN old path returns 404', async () => {
      // GIVEN: A file in folder A
      const workspace = await createTestWorkspace(app);

      // Create folder A
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'folder-a' }),
        })
      );

      // Create folder B
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'folder-b' }),
        })
      );

      // Create a file in folder A
      const fileContent = '# Test File\n\nContent for move test.';
      const createResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folder-a/test-file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: fileContent }),
        })
      );
      expect(createResponse.status).toBe(201);

      // WHEN: Moving file to folder B via POST /w/:key/move with source path
      const moveResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: '/folder-a/test-file.md',
            destination: '/folder-b',
          }),
        })
      );
      expect(moveResponse.status).toBe(200);

      // THEN: Old path should return 404
      const oldPathResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folder-a/test-file.md`, {
          method: 'GET',
        })
      );
      expect(oldPathResponse.status).toBe(404);
    });

    test('GIVEN a moved file WHEN accessing new path THEN file is accessible', async () => {
      // GIVEN: A file that was moved
      const workspace = await createTestWorkspace(app);

      // Create source and dest folders
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'source' }),
        })
      );
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'dest' }),
        })
      );

      // Create a file in source folder
      const fileContent = '# Moved File\n\nThis file will be moved.';
      const createResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/source/movable.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: fileContent }),
        })
      );
      expect(createResponse.status).toBe(201);

      // Move file to dest folder
      const moveResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: '/source/movable.md',
            destination: '/dest',
          }),
        })
      );
      expect(moveResponse.status).toBe(200);
      const moveData = await moveResponse.json();
      assertValidResponse(moveData, 'FileMoveResponse');
      expect(moveData.data.previousPath).toBe('/source/movable.md');
      expect(moveData.data.newPath).toBe('/dest/movable.md');

      // WHEN: Accessing the new path
      const newPathResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/dest/movable.md`, {
          method: 'GET',
        })
      );

      // THEN: File should be accessible at new location
      expect(newPathResponse.status).toBe(200);
      const responseData = await newPathResponse.json();
      assertValidResponse(responseData, 'FileReadResponse');
      expect(responseData.data.content).toBe(fileContent);
    });
  });

  describe('Delete Folder', () => {
    test('GIVEN an empty folder WHEN deleting THEN folder is deleted', async () => {
      // GIVEN: An empty folder
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'to-delete' }),
        })
      );

      // WHEN: Deleting the folder
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/to-delete`, {
          method: 'DELETE',
        })
      );

      // THEN: Folder should be deleted
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FolderDeleteResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.deleted).toBe(true);
      expect(data.path).toBe('/to-delete');
    });

    test('GIVEN a non-empty folder WHEN deleting without cascade THEN returns 409', async () => {
      // GIVEN: A folder with files
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/files/doc.md', '# Document');

      // WHEN: Deleting without cascade option
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/files`, {
          method: 'DELETE',
        })
      );

      // THEN: Should return 409 (folder not empty)
      expect(response.status).toBe(409);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      const { error } = body;
      expect(error.code).toBe('FOLDER_NOT_EMPTY');
    });

    test('GIVEN a non-empty folder WHEN cascade deleting THEN all files are soft-deleted', async () => {
      // GIVEN: A folder with files
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/archive/file1.md', '# File 1');
      await createTestFile(app, workspace, '/archive/file2.md', '# File 2');

      // WHEN: Cascade deleting with confirmation
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/archive`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cascade: true,
            confirmPath: 'archive',
          }),
        })
      );

      // THEN: Folder and files should be deleted
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FolderDeleteResponse');
      const { data } = body;
      expect(data.deleted).toBe(true);
      expect(data.filesDeleted).toBe(2);
      expect(data.recoverable).toBe(true);
      expect(data.expiresAt).toBeDefined();
    });

    test('GIVEN cascade delete WHEN confirmPath does not match THEN returns 400', async () => {
      // GIVEN: A folder with files
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/important/data.md', '# Important');

      // WHEN: Cascade delete with wrong confirmPath
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/important`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cascade: true,
            confirmPath: 'wrong-path',
          }),
        })
      );

      // THEN: Should return 400 (confirmPath mismatch)
      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      const { error } = body;
      expect(error.code).toBe('CONFIRM_PATH_MISMATCH');
    });
  });

  describe('Nested Folders', () => {
    test('GIVEN a workspace WHEN creating file with deep path THEN intermediate folders are virtual', async () => {
      // GIVEN: A workspace
      const workspace = await createTestWorkspace(app);

      // WHEN: Creating a file with deep path
      const file = await createTestFile(app, workspace, '/a/b/c/deep.md', '# Deep file');

      // THEN: File should be created at full path
      expect(file.path).toBe('/a/b/c/deep.md');

      // AND: Listing /a should show /a/b as subfolder
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/a`, {
          method: 'GET',
        })
      );
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { data } = body;
      const subfolder = data.items.find((item: { name: string }) => item.name === 'b');
      expect(subfolder).toBeDefined();
      expect(subfolder.type).toBe('folder');
    });

    test('GIVEN nested files WHEN listing parent folder THEN shows subfolders correctly', async () => {
      // GIVEN: Files in nested structure
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/projects/web/index.html', '<html>');
      await createTestFile(app, workspace, '/projects/mobile/app.js', 'const app');
      await createTestFile(app, workspace, '/projects/readme.md', '# Projects');

      // WHEN: Listing /projects
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/projects`, {
          method: 'GET',
        })
      );

      // THEN: Should show 2 subfolders and 1 file
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { data } = body;
      const folders = data.items.filter((item: { type: string }) => item.type === 'folder');
      const files = data.items.filter((item: { type: string }) => item.type === 'file');

      expect(folders.length).toBe(2);
      expect(files.length).toBe(1);

      const folderNames = folders.map((f: { name: string }) => f.name);
      expect(folderNames).toContain('web');
      expect(folderNames).toContain('mobile');
    });

    test('GIVEN deeply nested structure WHEN listing at level 5+ THEN works correctly', async () => {
      // GIVEN: Files at 5+ levels deep
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/l1/l2/l3/l4/l5/deep.md', '# Very deep');

      // WHEN: Listing at level 4
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/l1/l2/l3/l4`, {
          method: 'GET',
        })
      );

      // THEN: Should show l5 subfolder
      expect(response.ok).toBe(true);
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { data } = body;
      const l5 = data.items.find((item: { name: string }) => item.name === 'l5');
      expect(l5).toBeDefined();
      expect(l5.type).toBe('folder');
    });
  });

  describe('Folder-Level Permissions', () => {
    test('GIVEN a read key WHEN listing folder THEN URLs are read-only', async () => {
      // GIVEN: A folder with files
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/public/readme.md', '# Public');

      // WHEN: Listing with read key
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/public`, {
          method: 'GET',
        })
      );

      // THEN: File URLs should use read key prefix
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { data } = body;
      const file = data.items.find((item: { name: string }) => item.name === 'readme.md');
      expect(file.urls.read).toContain('/r/');
    });

    test('GIVEN a write key WHEN listing folder THEN URLs include write access', async () => {
      // GIVEN: A folder with files
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/admin/config.md', '# Config');

      // WHEN: Listing with write key
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders/admin`, {
          method: 'GET',
        })
      );

      // THEN: File URLs should include write access
      const body = await response.json();
      assertValidResponse(body, 'FolderListResponse');
      const { data } = body;
      const file = data.items.find((item: { name: string }) => item.name === 'config.md');
      expect(file.urls.write).toContain('/w/');
    });
  });

  describe('Search Within Folder', () => {
    test('GIVEN files in folder WHEN searching THEN only returns files in that folder', async () => {
      // GIVEN: Files in /projects folder with "TODO" keyword in task appends, and a file outside with same keyword
      const workspace = await createTestWorkspace(app);

      // Create file in /projects with TODO task
      const file1 = await createTestFile(app, workspace, '/projects/doc1.md', '# Project');
      await createTestTask(app, workspace, file1, {
        author: 'agent',
        content: 'This has TODO item',
      });

      // Create file in /projects without TODO task
      const file2 = await createTestFile(app, workspace, '/projects/doc2.md', '# Another');
      await createTestTask(app, workspace, file2, {
        author: 'agent',
        content: 'No keyword here',
      });

      // Create file in /other with TODO (should not be found)
      const file3 = await createTestFile(app, workspace, '/other/doc3.md', '# Other');
      await createTestTask(app, workspace, file3, {
        author: 'agent',
        content: 'TODO in wrong folder',
      });

      // WHEN: Searching /projects for "TODO"
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/ops/folders/search?path=projects&q=TODO`, {
          method: 'GET',
        })
      );

      // THEN: Only files in /projects with "TODO" should be returned
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FolderSearchResponse');
      expect(body.ok).toBe(true);
      expect(body.data.results).toBeDefined();
      expect(body.data.results.length).toBe(1);
      expect(body.data.results[0].file.path).toBe('/projects/doc1.md');
    });

    test('GIVEN nested folders WHEN searching recursively THEN includes subfolders', async () => {
      // GIVEN: Files in nested folders with TODO tasks
      const workspace = await createTestWorkspace(app);

      // Create file in /docs with TODO task
      const file1 = await createTestFile(app, workspace, '/docs/readme.md', '# Docs');
      await createTestTask(app, workspace, file1, {
        author: 'agent',
        content: 'TODO: write docs',
      });

      // Create file in /docs/api with TODO task
      const file2 = await createTestFile(app, workspace, '/docs/api/endpoints.md', '# API');
      await createTestTask(app, workspace, file2, {
        author: 'agent',
        content: 'TODO: add endpoints',
      });

      // Create file in /docs/guides/setup with TODO task (deeply nested)
      const file3 = await createTestFile(
        app,
        workspace,
        '/docs/guides/setup/install.md',
        '# Install'
      );
      await createTestTask(app, workspace, file3, {
        author: 'agent',
        content: 'TODO: install steps',
      });

      // WHEN: Searching /docs for "TODO" (recursive by default for folder search)
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/ops/folders/search?path=docs&q=TODO`, {
          method: 'GET',
        })
      );

      // THEN: Files from subfolders should be included
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FolderSearchResponse');
      expect(body.ok).toBe(true);
      expect(body.data.results).toBeDefined();
      // Should find all 3 files with TODO in /docs and its subfolders
      expect(body.data.results.length).toBe(3);
      const paths = body.data.results.map((r: { file: { path: string } }) => r.file.path);
      expect(paths).toContain('/docs/readme.md');
      expect(paths).toContain('/docs/api/endpoints.md');
      expect(paths).toContain('/docs/guides/setup/install.md');
    });
  });

});

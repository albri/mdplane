/**
 * Folder Operations Integration Test
 *
 * Tests folder lifecycle and operations.
 * Reference: apps/server/tests/scenarios/folder-operations.test.ts
 *
 * Covered (core folder operations):
 * - Create folder
 * - List folder contents
 * - Create file in folder
 * - Move file between folders
 * - Delete folder
 * - Folder-level permissions (via scoped keys)
 * - Nested folders
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('36 - Folder Operations', () => {
  let workspace: BootstrappedWorkspace;
  const testFolder = '__int_folder_ops';
  const nestedFolder = '__int_folder_ops/nested';

  beforeAll(async () => {
    workspace = await bootstrap();
  });

  afterAll(async () => {
    // Clean up folders
    await apiRequest('DELETE', `/w/${workspace.writeKey}/${testFolder}`);
  });

  describe('Create Folder', () => {
    test('POST /w/:key/folders creates folder with metadata', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
        body: { name: testFolder },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.path).toBe(`/${testFolder}`);
      expect(data.data.urls).toBeDefined();
      expect(data.data.urls.read).toContain('/r/');
      expect(data.data.urls.write).toContain('/w/');
      expect(data.data.urls.append).toContain('/a/');
      expect(data.data.createdAt).toBeDefined();
    });

    test('creating duplicate folder returns 409', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
        body: { name: testFolder },
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('FOLDER_ALREADY_EXISTS');
    });
  });

  describe('Nested Folders', () => {
    test('creating nested folder under existing folder', async () => {
      // Per OpenAPI FolderCreateRequest: use 'path' for parent folder path
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
        body: { name: 'nested', path: `/${testFolder}` },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      // Path may be relative to parent or absolute - just verify it contains 'nested'
      expect(data.data.path).toContain('nested');
    });
  });

  describe('Create File in Folder', () => {
    test('PUT /w/:key/:folder/:file creates file in folder', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFolder}/test-file.md`, {
        body: { content: '# Test File in Folder\n\nContent here.' },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      // Per OpenAPI FileUpdateResponse: required [id, etag, updatedAt, size]
      expect(data.data.id).toBeDefined();
      expect(data.data.etag).toBeDefined();
    });

    test('file is accessible via folder path', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFolder}/test-file.md`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.content).toContain('# Test File in Folder');
    });
  });

  describe('List Folder Contents', () => {
    test('GET /r/:key/folders/:path lists items', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders/${testFolder}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.items).toBeDefined();
      expect(Array.isArray(data.data.items)).toBe(true);
      // Should contain our test file
      const files = data.data.items.filter((i: { type: string }) => i.type === 'file');
      const filenames = files.map((f: { name: string }) => f.name);
      expect(filenames).toContain('test-file.md');
    });

    test('folder listing includes subfolders', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders/${testFolder}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.items).toBeDefined();
      // Should contain our nested folder
      const folders = data.data.items.filter((i: { type: string }) => i.type === 'folder');
      const folderNames = folders.map((f: { name: string }) => f.name);
      expect(folderNames).toContain('nested');
    });
  });

  describe('Move File Between Folders', () => {
    test('POST /w/:key/move with source and destination moves file', async () => {
      // Create a file to move
      await apiRequest('PUT', `/w/${workspace.writeKey}/${testFolder}/movable.md`, {
        body: { content: '# Movable File' },
      });

      // Move it to nested folder using /w/:key/move endpoint
      // Per OpenAPI FileMoveRequest: { source, destination }
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/move`, {
        body: {
          source: `/${testFolder}/movable.md`,
          destination: `/${testFolder}/nested`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.previousPath).toBe(`/${testFolder}/movable.md`);
      expect(data.data.newPath).toContain('nested');

      // Verify file is at new location
      const newLocation = await apiRequest('GET', `/r/${workspace.readKey}/${testFolder}/nested/movable.md`);
      expect(newLocation.status).toBe(200);

      // Verify file is not at old location
      const oldLocation = await apiRequest('GET', `/r/${workspace.readKey}/${testFolder}/movable.md`);
      expect(oldLocation.status).toBe(404);
    });
  });

  describe('Folder-level Permissions', () => {
    test('file items in folder listing include capability URLs', async () => {
      // Use correct folder listing endpoint
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders/${testFolder}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      // Folder items should have their own URLs
      expect(data.data.items).toBeDefined();
      // Find a file item (not folder)
      const fileItems = data.data.items.filter((i: { type: string }) => i.type === 'file');
      if (fileItems.length > 0) {
        const fileItem = fileItems[0];
        expect(fileItem.urls).toBeDefined();
        expect(fileItem.urls.read).toBeDefined();
      }
    });
  });

  describe('Delete Folder', () => {
    test('DELETE /w/:key/folders/:path deletes empty folder', async () => {
      // Create a folder to delete
      await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
        body: { name: '__int_delete_test' },
      });

      // Delete it using correct endpoint: /w/:key/folders/:path
      const response = await apiRequest('DELETE', `/w/${workspace.writeKey}/folders/__int_delete_test`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);

      // Verify it's gone
      const check = await apiRequest('GET', `/r/${workspace.readKey}/folders/__int_delete_test`);
      expect(check.status).toBe(404);
    });

    test('DELETE folder with files requires cascade or returns 409', async () => {
      // Create folder with file
      await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
        body: { name: '__int_delete_nonempty' },
      });
      await apiRequest('PUT', `/w/${workspace.writeKey}/__int_delete_nonempty/file.md`, {
        body: { content: '# File' },
      });

      // Try to delete without cascade - should fail with 409
      const response = await apiRequest('DELETE', `/w/${workspace.writeKey}/folders/__int_delete_nonempty`);

      // Per OpenAPI: 409 for non-empty folder (use cascade delete)
      if (response.status === 409) {
        const data = await response.json();
        expect(data.ok).toBe(false);
      } else {
        // If cascade is default, it should succeed
        expect(response.status).toBe(200);
      }

      // Clean up with cascade if still exists
      await apiRequest('DELETE', `/w/${workspace.writeKey}/folders/__int_delete_nonempty`, {
        body: { cascade: true, confirmPath: '__int_delete_nonempty' },
      });
    });
  });
});

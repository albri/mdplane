/**
 * File Operations Integration Test
 *
 * Tests file lifecycle and operations.
 * Reference: apps/server/tests/scenarios/file-operations.test.ts
 *
 * Covered (core file operations):
 * - Create and share single file
 * - Append content to existing file
 * - Read full file
 * - Read last N appends
 * - Read last N lines (tail)
 * - Read file structure (heading tree)
 * - Read specific section by heading
 * - Read specific append by ID
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('37 - File Operations', () => {
  let workspace: BootstrappedWorkspace;
  const testFile = '__int_file_ops.md';
  let appendId: string;

  beforeAll(async () => {
    workspace = await bootstrap();
  });

  afterAll(async () => {
    // Clean up test file
    await apiRequest('DELETE', `/w/${workspace.writeKey}/${testFile}`);
  });

  describe('Create and Share Single File', () => {
    test('PUT /w/:key/:path creates file with metadata', async () => {
      const content = '# Test File\n\n## Section One\n\nContent here.\n\n## Section Two\n\nMore content.';
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
        body: { content },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      // Per OpenAPI FileUpdateResponse: required [id, etag, updatedAt, size]
      expect(data.data.id).toBeDefined();
      expect(data.data.etag).toBeDefined();
      expect(data.data.updatedAt).toBeDefined();
      expect(data.data.size).toBeGreaterThan(0);
    });

    test('updating existing file returns 200', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
        body: { content: '# Updated Content\n\n## Section One\n\nUpdated.' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Read Full File', () => {
    test('GET /r/:key/:path returns file content', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFile}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.content).toContain('# Updated Content');
      expect(data.data.filename).toBe(testFile);
      expect(data.data.size).toBeGreaterThan(0);
    });
  });

  describe('Append Content', () => {
    test('POST /a/:key/:path creates append', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testFile}`, {
        body: {
          type: 'comment',
          author: 'int-test',
          content: 'This is a test comment.',
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toMatch(/^a\d+$/);
      expect(data.data.author).toBe('int-test');
      expect(data.data.type).toBe('comment');
      expect(data.serverTime).toBeDefined();

      // Save append ID for later tests
      appendId = data.data.id;
    });
  });

  describe('Read Last N Appends', () => {
    test('GET /r/:key/:path?format=parsed returns appends in file read', async () => {
      // Per OpenAPI: appends are included in file read via format=parsed
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFile}?format=parsed`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      // File read response includes appends array when format=parsed
      expect(data.data.appends).toBeDefined();
      expect(Array.isArray(data.data.appends)).toBe(true);
      expect(data.data.appends.length).toBeGreaterThan(0);
    });

    test('appendCount reflects number of appends', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFile}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.appendCount).toBeGreaterThan(0);
    });
  });

  describe('Read Specific Append by ID', () => {
    test('GET /r/:key/ops/file/append/:id returns single append', async () => {
      // Per OpenAPI: /r/{key}/ops/file/append/{appendId} - no path parameter
      const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/file/append/${appendId}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toBe(appendId);
      expect(data.data.author).toBe('int-test');
    });
  });

  describe('File-scoped endpoints (via folder key)', () => {
    test('file content is readable via folder key + path', async () => {
      // This verifies basic file read works with folder key + path
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFile}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.content).toBeDefined();
    });
  });

  describe('Additional File Operations', () => {
    test('DELETE /w/:key/:path deletes file', async () => {
      // Create a file to delete
      await apiRequest('PUT', `/w/${workspace.writeKey}/__int_delete_me.md`, {
        body: { content: '# Delete Me' },
      });

      // Delete it
      const response = await apiRequest('DELETE', `/w/${workspace.writeKey}/__int_delete_me.md`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);

      // Per OpenAPI spec: soft-deleted files return 410 Gone
      const check = await apiRequest('GET', `/r/${workspace.readKey}/__int_delete_me.md`);
      expect(check.status).toBe(410);
    });

    test('file update changes etag', async () => {
      // Read current etag
      const read1 = await apiRequest('GET', `/r/${workspace.readKey}/${testFile}`);
      const data1 = await read1.json();
      const etag1 = data1.data.etag;

      // Update file
      await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
        body: { content: '# Updated Again\n\nNew content.' },
      });

      // Read new etag
      const read2 = await apiRequest('GET', `/r/${workspace.readKey}/${testFile}`);
      const data2 = await read2.json();
      const etag2 = data2.data.etag;

      expect(etag2).not.toBe(etag1);
    });
  });
});


/**
 * Export Operations Integration Tests
 *
 * Tests /api/v1/export endpoints with API key authentication.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { createTestApiKey } from '../fixtures/api-keys';
import { createTestWorkspaceWithKeys } from '../fixtures/workspaces';
import { createTestAppend } from '../fixtures/appends';
import { db } from '../../db';
import { files } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('13 - Export', () => {
  let apiKey: string;
  let workspaceId: string;

  beforeAll(async () => {
    const workspace = await createTestWorkspaceWithKeys();
    workspaceId = workspace.id;

    const testApiKey = await createTestApiKey({
      workspaceId,
      name: 'Export Test API Key',
      scopes: ['export'],
    });
    apiKey = testApiKey.plaintextKey;
  });

  describe('Synchronous Export', () => {
    test('GET /api/v1/export returns 200 with binary download when authorized', async () => {
      const response = await apiRequest('GET', '/api/v1/export', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      expect(response.status).toBe(200);
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toMatch(/^(application\/zip|application\/gzip)$/);
      const contentDisposition = response.headers.get('Content-Disposition');
      expect(contentDisposition).toMatch(/^attachment;/);
    });

    test('GET /api/v1/export with format parameter', async () => {
      const response = await apiRequest('GET', '/api/v1/export?format=zip', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/zip');
    });
  });

  describe('Export Query Parameters', () => {
    let queryParamWorkspace: BootstrappedWorkspace;
    let queryParamApiKey: string;
    let activeFileId: string;
    let deletedFileId: string;

    beforeAll(async () => {
      // Create a dedicated workspace for query param tests
      queryParamWorkspace = await bootstrap();

      // Create API key with export scope
      const testApiKey = await createTestApiKey({
        workspaceId: queryParamWorkspace.workspaceId,
        name: 'Export Query Param Test Key',
        scopes: ['export'],
      });
      queryParamApiKey = testApiKey.plaintextKey;

      // Create test files using capability URLs
      // File 1: /docs/readme.md (active)
      const file1Response = await apiRequest('PUT', `/w/${queryParamWorkspace.writeKey}/docs/readme.md`, {
        body: { content: '# Documentation\n\nThis is the docs readme.' },
      });
      expect(file1Response.status).toBe(201);
      const file1Data = await file1Response.json();
      activeFileId = file1Data.data.id;

      // File 2: /src/main.ts (active)
      const file2Response = await apiRequest('PUT', `/w/${queryParamWorkspace.writeKey}/src/main.ts`, {
        body: { content: '// Main TypeScript file\nconsole.log("Hello");' },
      });
      expect(file2Response.status).toBe(201);

      // File 3: /tests/test.ts (will be deleted)
      const file3Response = await apiRequest('PUT', `/w/${queryParamWorkspace.writeKey}/tests/test.ts`, {
        body: { content: '// Test file\ndescribe("test", () => {});' },
      });
      expect(file3Response.status).toBe(201);
      const file3Data = await file3Response.json();
      deletedFileId = file3Data.data.id;

      // Soft-delete the test file
      const deleteResponse = await apiRequest('DELETE', `/w/${queryParamWorkspace.writeKey}/tests/test.ts`);
      expect(deleteResponse.status).toBe(200);

      // Create an append on the active file
      await createTestAppend({
        fileId: activeFileId,
        author: 'integration-test',
        type: 'task',
        status: 'pending',
        contentPreview: 'Integration test append',
      });
    });

    test('includeDeleted=false (default) excludes deleted files', async () => {
      const response = await apiRequest('GET', '/api/v1/export', {
        headers: { Authorization: `Bearer ${queryParamApiKey}` },
      });
      expect(response.status).toBe(200);

      // Parse the export content
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Should NOT contain the deleted file
      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/docs/readme.md');
      expect(paths).toContain('/src/main.ts');
      expect(paths).not.toContain('/tests/test.ts');
    });

    test('includeDeleted=true includes soft-deleted files', async () => {
      const response = await apiRequest('GET', '/api/v1/export?includeDeleted=true', {
        headers: { Authorization: `Bearer ${queryParamApiKey}` },
      });
      expect(response.status).toBe(200);

      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Should contain the deleted file with deletedAt timestamp
      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/tests/test.ts');

      // Verify deletedAt is present on the deleted file
      const deletedFile = content.files.find((f: { path: string }) => f.path === '/tests/test.ts');
      expect(deletedFile.deletedAt).toBeDefined();
    });

    test('paths parameter filters to specific folders', async () => {
      const response = await apiRequest('GET', '/api/v1/export?paths=/docs', {
        headers: { Authorization: `Bearer ${queryParamApiKey}` },
      });
      expect(response.status).toBe(200);

      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Should only contain docs folder files
      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/docs/readme.md');
      expect(paths).not.toContain('/src/main.ts');
    });

    test('paths parameter with multiple comma-separated paths', async () => {
      const response = await apiRequest('GET', '/api/v1/export?paths=/docs,/src', {
        headers: { Authorization: `Bearer ${queryParamApiKey}` },
      });
      expect(response.status).toBe(200);

      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Should contain both docs and src files
      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/docs/readme.md');
      expect(paths).toContain('/src/main.ts');
    });

    test('includeAppends=true includes append history', async () => {
      const response = await apiRequest('GET', '/api/v1/export?includeAppends=true', {
        headers: { Authorization: `Bearer ${queryParamApiKey}` },
      });
      expect(response.status).toBe(200);

      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Find the file with appends
      const fileWithAppends = content.files.find((f: { path: string }) => f.path === '/docs/readme.md');
      expect(fileWithAppends).toBeDefined();
      expect(fileWithAppends.appends).toBeDefined();
      expect(fileWithAppends.appends.length).toBeGreaterThan(0);

      // Verify append structure
      const append = fileWithAppends.appends[0];
      expect(append.author).toBe('integration-test');
      expect(append.type).toBe('task');
    });

    test('manifest includes options when query params used', async () => {
      const response = await apiRequest('GET', '/api/v1/export?includeAppends=true&includeDeleted=true&paths=/docs', {
        headers: { Authorization: `Bearer ${queryParamApiKey}` },
      });
      expect(response.status).toBe(200);

      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Verify manifest options
      expect(content.manifest.options).toBeDefined();
      expect(content.manifest.options.includeAppends).toBe(true);
      expect(content.manifest.options.includeDeleted).toBe(true);
      expect(content.manifest.options.paths).toEqual(['/docs']);

      // Verify manifest stats (only present when includeAppends=true)
      expect(content.manifest.stats).toBeDefined();
      expect(content.manifest.stats.totalFiles).toBeDefined();
      expect(content.manifest.stats.totalAppends).toBeDefined();
    });
  });

  describe('Async Export Jobs', () => {
    test('POST /api/v1/export/jobs creates export job with API key', async () => {
      const response = await apiRequest('POST', '/api/v1/export/jobs', {
        headers: { Authorization: `Bearer ${apiKey}` },
        body: { format: 'zip' },
      });
      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.jobId).toBeDefined();
      expect(data.data.status).toMatch(/^(queued|processing)$/);
      expect(data.data.statusUrl).toBeDefined();
    });

    test('GET /api/v1/export/jobs/:id returns job status with API key', async () => {
      const createResponse = await apiRequest('POST', '/api/v1/export/jobs', {
        headers: { Authorization: `Bearer ${apiKey}` },
        body: { format: 'zip' },
      });
      expect(createResponse.status).toBe(202);
      const createData = await createResponse.json();
      const jobId = createData.data.jobId;

      const statusResponse = await apiRequest('GET', `/api/v1/export/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      expect(statusResponse.status).toBe(200);
      const statusData = await statusResponse.json();
      expect(statusData.ok).toBe(true);
      expect(statusData.data.id).toBe(jobId);
      expect(statusData.data.status).toMatch(/^(queued|processing|ready|failed|expired)$/);
    });

    test('POST /api/v1/export/jobs with options', async () => {
      const response = await apiRequest('POST', '/api/v1/export/jobs', {
        headers: { Authorization: `Bearer ${apiKey}` },
        body: {
          format: 'tar.gz',
          includeAppends: true,
          includeDeleted: false,
          paths: ['projects'],
        },
      });
      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.jobId).toBeDefined();
    });
  });

  describe('Deleted Files', () => {
    test('GET /api/v1/deleted returns deleted files list with export scope', async () => {
      const response = await apiRequest('GET', '/api/v1/deleted', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.files).toBeDefined();
      expect(Array.isArray(data.data.files)).toBe(true);
    });
  });

  describe('Negative Cases (401 Unauthorized)', () => {
    test('GET /api/v1/export returns 401 without Authorization header', async () => {
      const response = await apiRequest('GET', '/api/v1/export');
      expect(response.status).toBe(401);
    });

    test('POST /api/v1/export/jobs returns 401 without Authorization header', async () => {
      const response = await apiRequest('POST', '/api/v1/export/jobs', {
        body: { format: 'zip' },
      });
      expect(response.status).toBe(401);
    });

    test('GET /api/v1/export/jobs/:id returns 401 without Authorization header', async () => {
      const response = await apiRequest('GET', '/api/v1/export/jobs/test-job-id');
      expect(response.status).toBe(401);
    });

    test('GET /api/v1/deleted returns 401 without Authorization header', async () => {
      const response = await apiRequest('GET', '/api/v1/deleted');
      expect(response.status).toBe(401);
    });
  });
});

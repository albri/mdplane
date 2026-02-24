/**
 * API Contract Compliance Tests
 *
 * Comprehensive tests to verify every endpoint matches the OpenAPI spec exactly.
 *
 * Test Categories:
 * - Response Structure Compliance: Every endpoint returns documented response codes
 * - Error Response Format: All errors follow { ok: false, error: { code, message } }
 * - Success Response Format: All successes follow { ok: true, data: { ... } }
 * - Headers Compliance: Content-Type, ETag, etc.
 * - Data Format Compliance: ID prefixes, date formats, booleans
 * - Schema Validation: Response shapes match OpenAPI schemas
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createTestApp } from '../helpers';
import {
  createTestWorkspace,
  createTestFile,
  readTestFile,
  deleteTestFile,
  createTestTask,
} from '../fixtures';
import { assertValidResponse } from '../helpers/schema-validator';

describe('API Contract Compliance', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Error Response Format', () => {
    test('400 Bad Request matches ErrorResponse schema', async () => {
      // GIVEN: A workspace with a file
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/test.md');

      // WHEN: Making a bad request (empty body to append endpoint)
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Missing required 'type' field
        })
      );

      // THEN: Returns proper error structure
      expect(response.status).toBe(400);
      const body = await response.json();

      assertValidResponse(body, 'Error');
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(typeof body.error.code).toBe('string');
      expect(typeof body.error.message).toBe('string');
    });

    test('404 Not Found matches ErrorResponse schema', async () => {
      // GIVEN: A workspace
      const workspace = await createTestWorkspace(app);

      // WHEN: Reading a non-existent file
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/nonexistent.md`, {
          method: 'GET',
        })
      );

      // THEN: Returns proper error structure
      expect(response.status).toBe(404);
      const body = await response.json();

      assertValidResponse(body, 'Error');
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error.code).toBe('FILE_NOT_FOUND');

      // Per OpenAPI spec: Error schema requires error.message field
      // See: packages/shared/openapi/components/schemas/core.yaml - Error schema
      expect(body.error).toHaveProperty('message');
    });

    test('409 Conflict matches ErrorResponse schema (already claimed task)', async () => {
      // GIVEN: A file with a claimed task
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/conflict-test.md');
      const task = await createTestTask(app, workspace, file, {
        author: 'agent-1',
        content: 'Test task for conflict',
      });

      // First claim
      await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            ref: task.ref,
            author: 'agent-1',
          }),
        })
      );

      // WHEN: Another agent tries to claim the same task
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            ref: task.ref,
            author: 'agent-2',
          }),
        })
      );

      // THEN: Returns 409 Conflict with proper error structure
      expect(response.status).toBe(409);
      const body = await response.json();

      assertValidResponse(body, 'Error');
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(body.error.code).toBe('ALREADY_CLAIMED');
    });

    test('410 Gone matches ErrorResponse schema (soft-deleted file)', async () => {
      // GIVEN: A soft-deleted file
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/deleted-test.md');
      await deleteTestFile(app, workspace, file.path, false); // soft delete

      // WHEN: Reading the deleted file
      const response = await readTestFile(app, workspace, file.path);

      // Per OpenAPI spec: Soft-deleted files return 410 Gone
      // See: packages/shared/openapi/components/responses.yaml - Gone response
      // THEN: Returns 410 Gone with proper error structure
      expect(response.status).toBe(410);
      const body = await response.json();

      assertValidResponse(body, 'Error');
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error.code).toBe('FILE_DELETED');
    });

    test('error response Content-Type is application/json', async () => {
      // GIVEN: A workspace
      const workspace = await createTestWorkspace(app);

      // WHEN: Making a request that returns an error
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/nonexistent.md`)
      );

      // THEN: Content-Type header is application/json
      expect(response.status).toBe(404);
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toMatch(/application\/json/);
    });
  });

  describe('Success Response Format', () => {
    test('200 OK has proper structure (file read)', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/success-200.md', '# Test');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, file.path);

      // THEN: Returns proper success structure
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    });

    test('200 OK has proper structure (file update)', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/update-200.md', '# Original');

      // WHEN: Updating the file
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated' }),
        })
      );

      // THEN: Returns proper success structure
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');
    });

    test('201 Created has proper structure (append)', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/append-201.md');

      // WHEN: Creating an append
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'Test comment',
          }),
        })
      );

      // THEN: Returns proper success structure
      expect(response.status).toBe(201);
      const body = await response.json();

      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');

      // Per OpenAPI spec: AppendResponse requires serverTime at top level
      // See: packages/shared/openapi/components/schemas/appends.yaml - AppendResponse
      expect(body).toHaveProperty('serverTime');
    });

    test('201 Created has proper structure (bootstrap)', async () => {
      // WHEN: Bootstrapping a new workspace
      const response = await app.handle(
        new Request('http://localhost/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceName: 'Contract Structure Test' }),
        })
      );

      // THEN: Returns proper success structure
      expect(response.status).toBe(201);
      const body = await response.json();

      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('workspaceId');
      expect(body.data).toHaveProperty('keys');
      expect(body.data).toHaveProperty('urls');
      expect(body.data).toHaveProperty('createdAt');
    });

    test('201 Created has proper structure (folder create)', async () => {
      // GIVEN: A workspace
      const workspace = await createTestWorkspace(app);

      // WHEN: Creating a folder
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'new-folder' }),
        })
      );

      // THEN: Returns proper success structure
      expect(response.status).toBe(201);
      const body = await response.json();

      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('path');
      expect(body.data).toHaveProperty('urls');
      expect(body.data).toHaveProperty('createdAt');
    });

    test('success response Content-Type is application/json', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/content-type-test.md');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, '/content-type-test.md');

      // THEN: Content-Type header is application/json
      expect(response.status).toBe(200);
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toMatch(/application\/json/);
    });
  });

  describe('ID Format Compliance', () => {
    test('workspace IDs are prefixed with ws_', async () => {
      // WHEN: Creating a workspace
      const workspace = await createTestWorkspace(app);

      // THEN: workspaceId has ws_ prefix
      expect(workspace.workspaceId).toMatch(/^ws_/);
    });

    test('workspace IDs contain only valid characters', async () => {
      // WHEN: Creating a workspace
      const workspace = await createTestWorkspace(app);

      // THEN: workspaceId follows pattern ws_[A-Za-z0-9]{12,}
      expect(workspace.workspaceId).toMatch(/^ws_[A-Za-z0-9]{12,}$/);
    });

    test('append IDs are prefixed with "a" followed by number', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/append-id-test.md');

      // WHEN: Creating an append
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'Test',
          }),
        })
      );

      // THEN: Append ID follows pattern a[0-9]+
      const { data } = await response.json();
      expect(data.id).toMatch(/^a\d+$/);
    });

    test('append IDs are sequential per file', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/sequential-ids.md');

      // WHEN: Creating multiple appends
      const appendIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const response = await app.handle(
          new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'test-user',
              content: `Comment ${i + 1}`,
            }),
          })
        );
        const { data } = await response.json();
        appendIds.push(data.id);
      }

      // THEN: Append IDs are sequential (a1, a2, a3)
      expect(appendIds[0]).toBe('a1');
      expect(appendIds[1]).toBe('a2');
      expect(appendIds[2]).toBe('a3');
    });

    test('file IDs are strings (not numeric)', async () => {
      // GIVEN: A workspace
      const workspace = await createTestWorkspace(app);

      // WHEN: Creating a file
      const file = await createTestFile(app, workspace, '/file-id-test.md');

      // THEN: File ID is a string
      expect(typeof file.id).toBe('string');
      expect(file.id.length).toBeGreaterThan(0);
    });
  });

  describe('Data Format Compliance', () => {
    test('date fields are ISO 8601 format (bootstrap)', async () => {
      // WHEN: Creating a workspace
      const response = await app.handle(
        new Request('http://localhost/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceName: 'Contract Date Format Test' }),
        })
      );

      // THEN: createdAt field is ISO 8601
      const { data } = await response.json();
      expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Should be parseable as Date
      expect(new Date(data.createdAt).toISOString()).toBeDefined();
    });

    test('date fields are ISO 8601 format (file read)', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/date-format-test.md');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, '/date-format-test.md');
      const { data } = await response.json();

      // THEN: createdAt and updatedAt fields are ISO 8601
      expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('date fields are ISO 8601 format (append)', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/append-date-test.md');

      // WHEN: Creating an append
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'Test',
          }),
        })
      );

      // THEN: ts (timestamp) field is ISO 8601
      const body = await response.json();
      expect(body.data.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Per OpenAPI spec: AppendResponse requires serverTime at top level
      // See: packages/shared/openapi/components/schemas/appends.yaml - AppendResponse
      expect(body.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('boolean fields are actual booleans, not strings', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/boolean-test.md');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, '/boolean-test.md');
      const body = await response.json();

      // THEN: ok field is a boolean
      expect(typeof body.ok).toBe('boolean');
      expect(body.ok).toBe(true);
    });

    test('numeric fields are actual numbers, not strings', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const content = '# Test file content';
      await createTestFile(app, workspace, '/numeric-test.md', content);

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, '/numeric-test.md');
      const { data } = await response.json();

      // THEN: numeric fields are actual numbers
      expect(typeof data.size).toBe('number');
      expect(typeof data.appendCount).toBe('number');
    });
  });

  describe('Headers Compliance', () => {
    test('file read response includes ETag header', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/etag-header-test.md');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, '/etag-header-test.md');

      // THEN: Response includes ETag header
      expect(response.status).toBe(200);
      expect(response.headers.get('ETag')).toBeDefined();
      expect(response.headers.get('ETag')!.length).toBeGreaterThan(0);
    });

    test('file update response includes ETag header', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/etag-update-test.md');

      // WHEN: Updating the file
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated content' }),
        })
      );

      // THEN: Response includes ETag header
      expect(response.status).toBe(200);
      expect(response.headers.get('ETag')).toBeDefined();
    });

    test('ETag changes after file update', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/etag-change-test.md', '# Original');

      // WHEN: Reading, updating, and reading again
      const readResponse1 = await readTestFile(app, workspace, file.path);
      const etag1 = readResponse1.headers.get('ETag');

      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated content' }),
        })
      );

      const readResponse2 = await readTestFile(app, workspace, file.path);
      const etag2 = readResponse2.headers.get('ETag');

      // THEN: ETags are different
      expect(etag1).toBeDefined();
      expect(etag2).toBeDefined();
      expect(etag1).not.toBe(etag2);
    });

    test('JSON responses have correct Content-Type', async () => {
      // GIVEN: A workspace
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/content-type-json.md');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, '/content-type-json.md');

      // THEN: Content-Type is application/json with charset
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toMatch(/application\/json/);
    });
  });

  describe('Schema Validation - Bootstrap', () => {
    test('POST /bootstrap matches BootstrapResponse schema', async () => {
      // WHEN: Bootstrapping a workspace
      const response = await app.handle(
        new Request('http://localhost/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceName: 'Schema Bootstrap Test' }),
        })
      );

      // THEN: Response matches BootstrapResponse schema
      expect(response.status).toBe(201);
      const body = await response.json();

      assertValidResponse(body, 'BootstrapResponse');

      // Top-level structure
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');

      // Required data fields per BootstrapResponse
      expect(body.data).toHaveProperty('workspaceId');
      expect(body.data).toHaveProperty('keys');
      expect(body.data).toHaveProperty('urls');
      expect(body.data).toHaveProperty('createdAt');

      // workspaceId format
      expect(body.data.workspaceId).toMatch(/^ws_[A-Za-z0-9]{12,}$/);

      // keys structure
      expect(body.data.keys).toHaveProperty('read');
      expect(body.data.keys).toHaveProperty('append');
      expect(body.data.keys).toHaveProperty('write');

      // urls.api structure
      expect(body.data.urls).toHaveProperty('api');
      expect(body.data.urls.api).toHaveProperty('read');
      expect(body.data.urls.api).toHaveProperty('append');
      expect(body.data.urls.api).toHaveProperty('write');

      // urls.web structure (workspace alias removed)
      expect(body.data.urls).toHaveProperty('web');
      expect(body.data.urls.web).toHaveProperty('read');
      expect(body.data.urls.web).toHaveProperty('claim');
    });
  });

  describe('Schema Validation - File Read', () => {
    test('GET /r/:key/:path matches FileReadResponse schema', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const content = '# Test File\n\nSome content here.';
      await createTestFile(app, workspace, '/schema-read-test.md', content);

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, '/schema-read-test.md');

      // THEN: Response matches FileReadResponse schema
      expect(response.status).toBe(200);
      const body = await response.json();

      assertValidResponse(body, 'FileReadResponse');

      // Top-level structure
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');

      // Required data fields per FileReadResponse
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('filename');
      expect(body.data).toHaveProperty('content');
      expect(body.data).toHaveProperty('etag');
      expect(body.data).toHaveProperty('createdAt');
      expect(body.data).toHaveProperty('updatedAt');
      expect(body.data).toHaveProperty('appendCount');
      expect(body.data).toHaveProperty('size');

      // Type validation
      expect(typeof body.data.id).toBe('string');
      expect(typeof body.data.filename).toBe('string');
      expect(typeof body.data.content).toBe('string');
      expect(typeof body.data.etag).toBe('string');
      expect(typeof body.data.createdAt).toBe('string');
      expect(typeof body.data.updatedAt).toBe('string');
      expect(typeof body.data.appendCount).toBe('number');
      expect(typeof body.data.size).toBe('number');

      // Content matches what was created
      expect(body.data.content).toBe(content);
      expect(body.data.filename).toBe('schema-read-test.md');
    });
  });

  describe('Schema Validation - Append', () => {
    test('POST /a/:key/:path matches AppendResponse schema', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/schema-append-test.md');

      // WHEN: Creating an append
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'test-user',
            content: 'Test task content',
          }),
        })
      );

      // THEN: Response matches AppendResponse schema
      expect(response.status).toBe(201);
      const body = await response.json();

      assertValidResponse(body, 'AppendResponse');

      // Top-level structure per AppendResponse
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');

      // Per OpenAPI spec: AppendResponse requires serverTime at top level
      // See: packages/shared/openapi/components/schemas/appends.yaml - AppendResponse
      expect(body).toHaveProperty('serverTime');

      // Required data fields per SingleAppendResult
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('author');
      expect(body.data).toHaveProperty('ts');
      expect(body.data).toHaveProperty('type');

      // Type validation
      expect(typeof body.data.id).toBe('string');
      expect(typeof body.data.author).toBe('string');
      expect(typeof body.data.ts).toBe('string');
      expect(typeof body.data.type).toBe('string');

      // Format validation
      expect(body.data.id).toMatch(/^a\d+$/);
      expect(body.data.author).toBe('test-user');
      expect(body.data.type).toBe('task');
    });

    test('claim append includes expires field', async () => {
      // GIVEN: A file with a task
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/claim-expires-test.md');
      const task = await createTestTask(app, workspace, file, {
        author: 'creator',
        content: 'Task to claim',
      });

      // WHEN: Claiming the task
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            ref: task.ref,
            author: 'claimer',
          }),
        })
      );

      // THEN: Response includes expires field
      expect(response.status).toBe(201);
      const { data } = await response.json();

      // Per OpenAPI spec: ClaimResult requires expiresAt field
      // See: packages/shared/openapi/components/schemas/appends.yaml - ClaimResult
      expect(data).toHaveProperty('expiresAt');
      expect(typeof data.expiresAt).toBe('string');
      expect(data.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Schema Validation - File Update', () => {
    test('PUT /w/:key/:path matches FileUpdateResponse schema', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/schema-update-test.md', '# Original');

      // WHEN: Updating the file
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated content' }),
        })
      );

      // THEN: Response matches FileUpdateResponse schema
      expect(response.status).toBe(200);
      const body = await response.json();

      assertValidResponse(body, 'FileUpdateResponse');

      // Top-level structure
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');

      // Required data fields per FileUpdateResponse
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('etag');
      expect(body.data).toHaveProperty('updatedAt');
      expect(body.data).toHaveProperty('size');

      // Type validation
      expect(typeof body.data.id).toBe('string');
      expect(typeof body.data.etag).toBe('string');
      expect(typeof body.data.updatedAt).toBe('string');
      expect(typeof body.data.size).toBe('number');

      // Value validation
      expect(body.data.id).toBe(file.id);
      expect(body.data.size).toBe('# Updated content'.length);
    });
  });

  describe('Schema Validation - File Delete', () => {
    test('DELETE /w/:key/:path matches FileDeleteResponse schema', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/schema-delete-test.md');

      // WHEN: Deleting the file (soft delete)
      const response = await deleteTestFile(app, workspace, file.path, false);

      // THEN: Response matches FileDeleteResponse schema
      expect(response.status).toBe(200);
      const body = await response.json();

      assertValidResponse(body, 'FileDeleteResponse');

      // Top-level structure
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');

      // Required data fields per FileDeleteResponse
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('deleted', true);

      // Optional fields for soft delete
      expect(body.data).toHaveProperty('recoverable');
      expect(typeof body.data.recoverable).toBe('boolean');
    });
  });

  describe('Schema Validation - Folder Create', () => {
    test('POST /w/:key/folders matches FolderCreateResponse schema', async () => {
      // GIVEN: A workspace
      const workspace = await createTestWorkspace(app);

      // WHEN: Creating a folder
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'schema-test-folder' }),
        })
      );

      // THEN: Response matches FolderCreateResponse schema
      expect(response.status).toBe(201);
      const body = await response.json();

      assertValidResponse(body, 'FolderCreateResponse');

      // Top-level structure
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');

      // Required data fields per FolderCreateResponse
      expect(body.data).toHaveProperty('path');
      expect(body.data).toHaveProperty('urls');
      expect(body.data).toHaveProperty('createdAt');

      // URLs structure per CapabilityUrls
      expect(body.data.urls).toHaveProperty('read');
      expect(body.data.urls).toHaveProperty('append');
      expect(body.data.urls).toHaveProperty('write');

      // Type validation
      expect(typeof body.data.path).toBe('string');
      expect(typeof body.data.createdAt).toBe('string');

      // Value validation
      expect(body.data.path).toBe('/schema-test-folder');
    });
  });

  describe('No Undocumented Fields', () => {
    test('bootstrap response contains only documented fields', async () => {
      // WHEN: Bootstrapping a workspace
      const response = await app.handle(
        new Request('http://localhost/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceName: 'Undocumented Fields Test' }),
        })
      );

      // THEN: Response contains only documented fields
      const body = await response.json();

      // Top level keys should only be ok and data
      const topLevelKeys = Object.keys(body);
      expect(topLevelKeys).toContain('ok');
      expect(topLevelKeys).toContain('data');
      expect(topLevelKeys.length).toBe(2);

      // data keys should match BootstrapResponse.data
      const dataKeys = Object.keys(body.data);
      const allowedDataKeys = ['workspaceId', 'keys', 'urls', 'createdAt'];
      for (const key of dataKeys) {
        expect(allowedDataKeys).toContain(key);
      }
    });

    test('file read response contains only documented fields', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, '/documented-fields-test.md');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, '/documented-fields-test.md');
      const body = await response.json();

      // THEN: Response contains only documented fields
      const topLevelKeys = Object.keys(body);
      expect(topLevelKeys).toContain('ok');
      expect(topLevelKeys).toContain('data');
      expect(topLevelKeys.length).toBe(2);

      // data keys should match FileReadResponse.data
      const dataKeys = Object.keys(body.data);
      const allowedDataKeys = [
        'id',
        'filename',
        'content',
        'etag',
        'createdAt',
        'updatedAt',
        'appendCount',
        'size',
        // Optional fields
        'frontmatter',
        'appends',
        'stats',
        'webUrl',
        'workspace',
      ];
      for (const key of dataKeys) {
        expect(allowedDataKeys).toContain(key);
      }
    });
  });

});

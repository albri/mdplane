/**
 * API v1 Integration Tests
 * Tests core /api/v1 endpoints with API key authentication
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest } from '../helpers/api-client';
import { createTestApiKey } from '../fixtures/api-keys';
import { createTestWorkspaceWithKeys } from '../fixtures/workspaces';
import { uniqueName } from '../helpers/test-utils';

describe('26 - API v1 Endpoints', () => {
  let apiKey: string;
  let writeKey: string;

  // Test constants
  const testFilePath = `integration-test-${uniqueName('file')}.md`;
  const testFolderName = `integration-test-${uniqueName('folder')}`;
  const testContent = '# API v1 Integration Test\n\nThis file was created by integration tests.';
  const testAppendContent = 'This is an append from integration test.';
  const searchTerm = 'integration-test';

  beforeAll(async () => {
    // Create a workspace
    const workspace = await createTestWorkspaceWithKeys();
    writeKey = workspace.writeKey.plaintextKey;

    // Create an API key for the workspace
    const testApiKey = await createTestApiKey({
      workspaceId: workspace.id,
      name: 'Integration Test API Key',
      mode: 'test',
      scopes: ['read', 'write', 'append'],
    });
    apiKey = testApiKey.plaintextKey;
  });

  // Create file by path
  test('POST /api/v1/files/{path} creates file with API key', async () => {
    const response = await apiRequest('POST', `/api/v1/files/${testFilePath}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: { content: testContent },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    expect(data.data.path).toBeDefined();
  });

  // Read file by path
  test('GET /api/v1/files/{path} reads file with API key', async () => {
    const response = await apiRequest('GET', `/api/v1/files/${testFilePath}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toBe(testContent);
    // Verify ETag header is present
    const etag = response.headers.get('ETag');
    expect(etag).toBeDefined();
  });

  // Update file by path
  test('PUT /api/v1/files/{path} updates file with API key', async () => {
    const updatedContent = testContent + '\n\nUpdated by integration test.';
    const response = await apiRequest('PUT', `/api/v1/files/${testFilePath}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: { content: updatedContent },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    // Verify ETag header is present
    const etag = response.headers.get('ETag');
    expect(etag).toBeDefined();
  });

  // Append to file by path
  test('POST /api/v1/files/{path}/append appends to file with API key', async () => {
    const response = await apiRequest('POST', `/api/v1/files/${testFilePath}/append`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        author: '__int_test',
        type: 'comment',
        content: testAppendContent,
      },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
  });

  // Verify append is in file content
  test('append content is reflected in file', async () => {
    const response = await apiRequest('GET', `/api/v1/files/${testFilePath}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.content).toContain(testAppendContent);
  });

  // Delete file by path (soft delete)
  const deleteTestFile = `integration-test-${uniqueName('delete')}.md`;
  test('DELETE /api/v1/files/{path} soft deletes file with API key', async () => {
    // First create a file to delete
    const createResponse = await apiRequest('POST', `/api/v1/files/${deleteTestFile}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: { content: '# File to delete' },
    });
    expect(createResponse.status).toBe(201);

    // Delete the file (soft delete)
    const deleteResponse = await apiRequest('DELETE', `/api/v1/files/${deleteTestFile}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(deleteResponse.status).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.ok).toBe(true);
    expect(deleteData.data.deleted).toBe(true);
    expect(deleteData.data.recoverable).toBe(true);

    // Verify file is no longer accessible (should return 404 or 410)
    const getResponse = await apiRequest('GET', `/api/v1/files/${deleteTestFile}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect([404, 410]).toContain(getResponse.status);
  });

  // Delete file by path (permanent delete)
  const permanentDeleteFile = `integration-test-${uniqueName('perm-delete')}.md`;
  test('DELETE /api/v1/files/{path}?permanent=true permanently deletes file', async () => {
    // First create a file to delete
    const createResponse = await apiRequest('POST', `/api/v1/files/${permanentDeleteFile}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: { content: '# File to permanently delete' },
    });
    expect(createResponse.status).toBe(201);

    // Delete the file permanently
    const deleteResponse = await apiRequest('DELETE', `/api/v1/files/${permanentDeleteFile}?permanent=true`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(deleteResponse.status).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.ok).toBe(true);
    expect(deleteData.data.deleted).toBe(true);
    expect(deleteData.data.recoverable).toBe(false);
  });

  // Create folder by path
  test('POST /api/v1/folders creates folder at root with API key', async () => {
    const response = await apiRequest('POST', '/api/v1/folders', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: { name: testFolderName },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.path).toBeDefined();
  });

  // List folder by path (root)
  test('GET /api/v1/folders lists root folder with API key', async () => {
    const response = await apiRequest('GET', '/api/v1/folders', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(Array.isArray(data.data.items)).toBe(true);
  });

  // List folder by path (nested)
  test('GET /api/v1/folders/{path} lists folder with API key', async () => {
    const response = await apiRequest('GET', `/api/v1/folders/${testFolderName}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(Array.isArray(data.data.items)).toBe(true);
  });

  // Create folder by path (nested)
  const nestedFolderName = `${testFolderName}/nested`;
  test('POST /api/v1/folders/{path} creates nested folder with API key', async () => {
    const response = await apiRequest('POST', `/api/v1/folders/${testFolderName}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: { name: 'nested' },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // Delete empty folder
  const emptyFolderName = `integration-test-${uniqueName('empty-folder')}`;
  test('DELETE /api/v1/folders/{path} deletes empty folder', async () => {
    // First create an empty folder
    const createResponse = await apiRequest('POST', '/api/v1/folders', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: { name: emptyFolderName },
    });
    expect(createResponse.status).toBe(201);

    // Now delete the empty folder
    const deleteResponse = await apiRequest('DELETE', `/api/v1/folders/${emptyFolderName}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(deleteResponse.status).toBe(200);
    const data = await deleteResponse.json();
    expect(data.ok).toBe(true);
    expect(data.data.deleted).toBe(true);
    expect(data.data.path).toBe(`/${emptyFolderName}`);
  });

  // Delete non-empty folder without cascade should fail
  test('DELETE /api/v1/folders/{path} returns 409 for non-empty folder without cascade', async () => {
    // Create a folder with a file inside
    const nonEmptyFolderName = `integration-test-${uniqueName('non-empty')}`;
    await apiRequest('POST', '/api/v1/folders', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: { name: nonEmptyFolderName },
    });
    await apiRequest('POST', `/api/v1/files/${nonEmptyFolderName}%2Ftest-file.md`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: { content: 'test content' },
    });

    // Try to delete without cascade
    const response = await apiRequest('DELETE', `/api/v1/folders/${nonEmptyFolderName}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('FOLDER_NOT_EMPTY');
  });

  // Delete non-empty folder with wrong confirmPath should fail
  test('DELETE /api/v1/folders/{path} returns 400 for cascade with wrong confirmPath', async () => {
    // Create a folder with a file inside
    const cascadeFolderName = `integration-test-${uniqueName('cascade-wrong')}`;
    await apiRequest('POST', '/api/v1/folders', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: { name: cascadeFolderName },
    });
    await apiRequest('POST', `/api/v1/files/${cascadeFolderName}%2Ftest-file.md`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: { content: 'test content' },
    });

    // Try to delete with cascade but wrong confirmPath
    const response = await apiRequest('DELETE', `/api/v1/folders/${cascadeFolderName}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: { cascade: true, confirmPath: 'wrong-path' },
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('CONFIRM_PATH_MISMATCH');
  });

  // Delete non-empty folder with cascade and correct confirmPath
  test('DELETE /api/v1/folders/{path} cascade deletes with correct confirmPath', async () => {
    // Create a folder with files inside
    const cascadeFolderName = `integration-test-${uniqueName('cascade-ok')}`;
    await apiRequest('POST', '/api/v1/folders', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: { name: cascadeFolderName },
    });
    await apiRequest('POST', `/api/v1/files/${cascadeFolderName}%2Ftest-file1.md`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: { content: 'test content 1' },
    });
    await apiRequest('POST', `/api/v1/files/${cascadeFolderName}%2Ftest-file2.md`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: { content: 'test content 2' },
    });

    // Delete with cascade and correct confirmPath
    const response = await apiRequest('DELETE', `/api/v1/folders/${cascadeFolderName}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: { cascade: true, confirmPath: cascadeFolderName },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.deleted).toBe(true);
    expect(data.data.filesDeleted).toBeGreaterThanOrEqual(2);
    expect(data.data.recoverable).toBe(true);
  });

  // Search workspace
  test('GET /api/v1/search searches workspace with API key', async () => {
    const response = await apiRequest('GET', `/api/v1/search?q=${searchTerm}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.results).toBeDefined();
    expect(Array.isArray(data.data.results)).toBe(true);
  });

  // Search with path filter
  test('GET /api/v1/search?path= filters search by path', async () => {
    const response = await apiRequest('GET', `/api/v1/search?q=${searchTerm}&path=${testFolderName}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // Get workspace stats
  test('GET /api/v1/stats returns workspace stats with API key', async () => {
    const response = await apiRequest('GET', '/api/v1/stats', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.fileCount).toBeDefined();
    expect(data.data.folderCount).toBeDefined();
    expect(data.data.totalSize).toBeDefined();
    expect(data.data.appendCount).toBeDefined();
    expect(data.data.taskStats).toBeDefined();
  });

  // Files endpoint without auth
  test('GET /api/v1/files/{path} returns 401 without Authorization', async () => {
    const response = await apiRequest('GET', `/api/v1/files/${testFilePath}`);
    expect(response.status).toBe(401);
  });

  // Folders endpoint without auth
  test('GET /api/v1/folders returns 401 without Authorization', async () => {
    const response = await apiRequest('GET', '/api/v1/folders');
    expect(response.status).toBe(401);
  });

  // Search endpoint without auth
  test('GET /api/v1/search returns 401 without Authorization', async () => {
    const response = await apiRequest('GET', `/api/v1/search?q=test`);
    expect(response.status).toBe(401);
  });

  // Stats endpoint without auth
  test('GET /api/v1/stats returns 401 without Authorization', async () => {
    const response = await apiRequest('GET', '/api/v1/stats');
    expect(response.status).toBe(401);
  });

  // Create file without auth
  test('POST /api/v1/files/{path} returns 401 without Authorization', async () => {
    const response = await apiRequest('POST', `/api/v1/files/test-unauth.md`, {
      body: { content: 'This should fail' },
    });
    expect(response.status).toBe(401);
  });

  // Create folder without auth
  test('POST /api/v1/folders returns 401 without Authorization', async () => {
    const response = await apiRequest('POST', '/api/v1/folders', {
      body: { name: 'test-unauth' },
    });
    expect(response.status).toBe(401);
  });

  // Append without auth
  test('POST /api/v1/files/{path}/append returns 401 without Authorization', async () => {
    const response = await apiRequest('POST', `/api/v1/files/${testFilePath}/append`, {
      body: {
        author: 'test',
        type: 'comment',
        content: 'This should fail',
      },
    });
    expect(response.status).toBe(401);
  });
});

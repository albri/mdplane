/**
 * Soft Delete & Recovery Integration Tests
 *
 * Note: The recover endpoint POST /w/:key/recover uses a FILE-SCOPED write key,
 * not a workspace write key with a path. The key identifies the specific file.
 *
 * File-scoped keys are obtained from POST /w/:key/folders/files (not PUT /w/:key/:path).
 */

import { describe, test, expect } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('17 - Recovery', () => {
  let workspace: BootstrappedWorkspace;
  const testFileName = `${uniqueName('recovery')}.md`;
  const testContent = '# Recovery Test\n\nFile for testing soft delete and recovery.';
  let fileWriteKey: string;
  let fileReadKey: string;

  test('bootstrap workspace and create test file', async () => {
    workspace = await bootstrap('recovery');

    // Create test file via folders endpoint to get file-scoped keys
    const createResponse = await apiRequest('POST', `/w/${workspace.writeKey}/folders/files`, {
      body: { filename: testFileName, content: testContent },
    });
    expect(createResponse.status).toBe(201);
    const createData = await createResponse.json();

    // Extract file-scoped keys from response
    const writeUrl = createData.data.urls.write;
    const readUrl = createData.data.urls.read;
    fileWriteKey = writeUrl.match(/\/w\/([^/]+)/)?.[1] || '';
    fileReadKey = readUrl.match(/\/r\/([^/]+)/)?.[1] || '';
  });

  test('file is accessible before deletion', async () => {
    const response = await apiRequest('GET', `/r/${fileReadKey}/${testFileName}`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.content).toBe(testContent);
  });

  test('DELETE /w/:key/:path soft deletes file', async () => {
    const response = await apiRequest('DELETE', `/w/${fileWriteKey}/${testFileName}`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  test('deleted file returns 410 Gone', async () => {
    const response = await apiRequest('GET', `/r/${fileReadKey}/${testFileName}`);

    expect(response.status).toBe(410);
  });

  test('POST /w/:key/recover restores file', async () => {
    const response = await apiRequest('POST', `/w/${fileWriteKey}/recover`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.recovered).toBe(true);
    expect(data.data.path).toBeDefined();
    expect(data.data.urls).toBeDefined();
  });

  test('recovered file is accessible', async () => {
    const response = await apiRequest('GET', `/r/${fileReadKey}/${testFileName}`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.content).toBe(testContent);
  });

  test('recover non-existent file returns 404', async () => {
    const response = await apiRequest('POST', `/w/invalid_key_12345678901234567890/recover`);

    expect(response.status).toBe(404);
  });
});

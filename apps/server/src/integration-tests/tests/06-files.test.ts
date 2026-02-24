/**
 * File Operations Integration Tests
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('06 - File Operations', () => {
  let workspace: BootstrappedWorkspace;
  const testFileName = `${uniqueName('file')}.md`;
  const testContent = '# Test File\n\nCreated by integration tests.';

  beforeAll(async () => {
    workspace = await bootstrap();
  });

  test('PUT /w/:key/* creates new file', async () => {
    const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
      body: { content: testContent },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    expect(data.data.etag).toBeDefined();
    expect(data.data.updatedAt).toBeDefined();
    expect(data.data.size).toBeDefined();
  });

  test('GET /r/:key/* reads file', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFileName}`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.content).toBe(testContent);
  });

  test('GET /w/:key/* reads file with write key', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/${testFileName}`);
    expect(response.ok).toBe(true);
  });

  test('GET /r/:key/meta returns file metadata', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/meta`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.filename).toBeDefined();
    expect(data.data.size).toBeDefined();
  });

  test('GET /r/:key/raw returns raw content', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/raw`);
    expect(response.ok).toBe(true);
    const text = await response.text();
    expect(text.length).toBeGreaterThan(0);
  });

  test('GET /r/:key/structure returns headings', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/structure`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.headings).toBeDefined();
    expect(Array.isArray(data.data.headings)).toBe(true);
  });

  test('GET /r/:key/tail returns recent content', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/tail`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.content).toBeDefined();
  });

  test('PUT /w/:key/* updates existing file', async () => {
    const updatedContent = testContent + '\n\nUpdated by integration test.';
    const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
      body: { content: updatedContent },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  test('GET /w/:key/settings returns settings', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/settings`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  test('PATCH /w/:key/settings updates settings', async () => {
    const response = await apiRequest('PATCH', `/w/${workspace.writeKey}/settings`, {
      body: { appendsEnabled: true },
    });
    expect(response.ok).toBe(true);
  });

  test('GET /r/:key/section/:heading returns section', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/section/Test%20File`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(typeof data.data.content).toBe('string');
  });

  const deleteFileName = `${uniqueName('delete')}.md`;
  let deleteFileWriteKey: string;
  let deleteFileReadKey: string;

  test('create file for deletion test', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/folders/files`, {
      body: { filename: deleteFileName, content: 'File to be deleted' },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    const writeUrl = data.data.urls.write;
    const readUrl = data.data.urls.read;
    deleteFileWriteKey = writeUrl.match(/\/w\/([^/]+)/)?.[1] || '';
    deleteFileReadKey = readUrl.match(/\/r\/([^/]+)/)?.[1] || '';
    expect(deleteFileWriteKey).toBeTruthy();
  });

  test('DELETE /w/:key/:path soft deletes file', async () => {
    const response = await apiRequest('DELETE', `/w/${deleteFileWriteKey}/${deleteFileName}`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  test('deleted file returns 410 Gone', async () => {
    const response = await apiRequest('GET', `/r/${deleteFileReadKey}/${deleteFileName}`);
    expect(response.status).toBe(410);
  });

  test('POST /w/:key/recover restores file', async () => {
    const response = await apiRequest('POST', `/w/${deleteFileWriteKey}/recover`);
    expect(response.ok).toBe(true);
  });

  test('recovered file is accessible', async () => {
    const response = await apiRequest('GET', `/r/${deleteFileReadKey}/${deleteFileName}`);
    expect(response.ok).toBe(true);
  });

  const moveFileName = `${uniqueName('move')}.md`;
  const movedFileName = `${uniqueName('moved')}.md`;
  let moveFileWriteKey: string;

  test('POST /w/:key/move moves file', async () => {
    const createRes = await apiRequest('POST', `/w/${workspace.writeKey}/folders/files`, {
      body: { filename: moveFileName, content: 'File to be moved' },
    });
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    moveFileWriteKey = createData.data.urls.write.match(/\/w\/([^/]+)/)?.[1] || '';

    const response = await apiRequest('POST', `/w/${moveFileWriteKey}/move`, {
      body: { source: `/${moveFileName}`, destination: `/${movedFileName}` },
    });
    expect(response.ok).toBe(true);
  });

  // Test PATCH /w/:key - Rename file (Route #23)
  const renameFileName = `${uniqueName('rename')}.md`;
  const renamedFileName = `${uniqueName('renamed')}.md`;
  let renameFileWriteKey: string;
  let renameFileReadKey: string;

  test('PATCH /w/:key renames file', async () => {
    // Create a file for rename testing
    const createRes = await apiRequest('POST', `/w/${workspace.writeKey}/folders/files`, {
      body: { filename: renameFileName, content: 'File to be renamed' },
    });
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    renameFileWriteKey = createData.data.urls.write.match(/\/w\/([^/]+)/)?.[1] || '';
    renameFileReadKey = createData.data.urls.read.match(/\/r\/([^/]+)/)?.[1] || '';

    // Rename the file
    const response = await apiRequest('PATCH', `/w/${renameFileWriteKey}`, {
      body: { filename: renamedFileName },
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    expect(data.data.filename).toBe(renamedFileName);
  });

  test('renamed file is accessible at new path', async () => {
    const response = await apiRequest('GET', `/r/${renameFileReadKey}/${renamedFileName}`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.content).toBe('File to be renamed');
  });

  test('PATCH /w/:key returns 404 for invalid key', async () => {
    const response = await apiRequest('PATCH', '/w/invalid-key-format', {
      body: { filename: 'new-name.md' },
    });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.ok).toBe(false);
  });

  // Test readAppend - GET /r/:key/ops/file/append/:appendId (Route #19)
  const appendTestFileName = `${uniqueName('append-test')}.md`;
  let appendTestAppendKey: string;
  let appendTestReadKey: string;
  let createdAppendId: string;

  test('setup: create file for append test', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/folders/files`, {
      body: { filename: appendTestFileName, content: '# Append Test\n\nFile for testing append read.' },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    appendTestAppendKey = data.data.urls.append.match(/\/a\/([^/]+)/)?.[1] || '';
    appendTestReadKey = data.data.urls.read.match(/\/r\/([^/]+)/)?.[1] || '';
    expect(appendTestAppendKey).toBeTruthy();
    expect(appendTestReadKey).toBeTruthy();
  });

  test('setup: create append via POST /a/:key/append', async () => {
    const response = await apiRequest('POST', `/a/${appendTestAppendKey}/append`, {
      body: {
        author: 'integration-test',
        type: 'comment',
        content: 'This is a test comment for readAppend',
      },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    createdAppendId = data.data.id;
    expect(createdAppendId).toMatch(/^a\d+$/);
  });

  test('GET /r/:key/ops/file/append/:appendId reads specific append', async () => {
    const response = await apiRequest('GET', `/r/${appendTestReadKey}/ops/file/append/${createdAppendId}`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBe(createdAppendId);
    expect(data.data.author).toBe('integration-test');
    expect(data.data.type).toBe('comment');
    expect(data.data.ts).toBeDefined();
  });

  test('GET /r/:key/ops/file/append/:appendId returns 404 for non-existent append', async () => {
    const response = await apiRequest('GET', `/r/${appendTestReadKey}/ops/file/append/a999999999`);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('APPEND_NOT_FOUND');
  });

  test('GET /r/:key/ops/file/append/:appendId returns 400 for invalid append ID format', async () => {
    const response = await apiRequest('GET', `/r/${appendTestReadKey}/ops/file/append/invalid`);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INVALID_APPEND_ID');
  });
});

/**
 * POST /w/:key/rotate - Rotate Capability URLs Integration Tests
 *
 * Tests the file-level URL rotation endpoint that revokes old keys
 * and generates new capability URLs.
 */
describe('06 - File Rotate URLs', () => {
  let workspace: BootstrappedWorkspace;
  const rotateTestFileName = `${uniqueName('rotate')}.md`;

  beforeAll(async () => {
    workspace = await bootstrap();
    // Create a file for rotation testing
    const createResponse = await apiRequest('PUT', `/w/${workspace.writeKey}/${rotateTestFileName}`, {
      body: { content: '# Rotate Test\n\nFile for testing URL rotation.' },
    });
    expect(createResponse.status).toBe(201);
  });

  test('POST /w/:key/rotate rotates file URLs successfully', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/rotate`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.urls).toBeDefined();
    expect(data.data.urls.read).toBeDefined();
    expect(data.data.urls.append).toBeDefined();
    expect(data.data.urls.write).toBeDefined();
    expect(data.data.previousUrlsInvalidated).toBe(true);
    expect(data.data.webUrl).toBeDefined();

    // Store new keys for subsequent tests
    workspace.readKey = data.data.urls.read.split('/r/')[1];
    workspace.appendKey = data.data.urls.append.split('/a/')[1];
    workspace.writeKey = data.data.urls.write.split('/w/')[1];
  });

  test('file-scoped keys from first rotation are invalidated after second rotation', async () => {
    // Bootstrap a fresh workspace for this test
    const freshWorkspace = await bootstrap();
    const testFile = `${uniqueName('rotate-old-key')}.md`;

    // Create a file using workspace write key
    const createResponse = await apiRequest('PUT', `/w/${freshWorkspace.writeKey}/${testFile}`, {
      body: { content: '# Old Key Test' },
    });
    expect(createResponse.status).toBe(201);

    // First rotation: creates file-scoped URLs
    const firstRotateResponse = await apiRequest('POST', `/w/${freshWorkspace.writeKey}/rotate`);
    expect(firstRotateResponse.status).toBe(200);
    const firstRotateData = await firstRotateResponse.json();

    // Extract the file-scoped keys from first rotation
    const firstReadKey = firstRotateData.data.urls.read.split('/r/')[1];
    const firstWriteKey = firstRotateData.data.urls.write.split('/w/')[1];

    // Verify first file-scoped read key works
    const preSecondRotateResponse = await apiRequest('GET', `/r/${firstReadKey}/${testFile}`);
    expect(preSecondRotateResponse.status).toBe(200);

    // Second rotation: should invalidate first rotation's keys
    const secondRotateResponse = await apiRequest('POST', `/w/${firstWriteKey}/rotate`);
    expect(secondRotateResponse.status).toBe(200);

    // First rotation's file-scoped read key should now be invalid
    const postRotateResponse = await apiRequest('GET', `/r/${firstReadKey}/${testFile}`);
    expect(postRotateResponse.status).toBe(404);
    const data = await postRotateResponse.json();
    expect(data.error.code).toBe('KEY_REVOKED');

    // Workspace read key should still work (not affected by file rotation)
    const workspaceReadResponse = await apiRequest('GET', `/r/${freshWorkspace.readKey}/${testFile}`);
    expect(workspaceReadResponse.status).toBe(200);
  });

  test('new file-scoped keys work after rotation', async () => {
    // Bootstrap a fresh workspace for this test
    const freshWorkspace = await bootstrap();
    const testFile = `${uniqueName('rotate-new-key')}.md`;

    // Create a file using workspace write key
    const createResponse = await apiRequest('PUT', `/w/${freshWorkspace.writeKey}/${testFile}`, {
      body: { content: '# New Key Test' },
    });
    expect(createResponse.status).toBe(201);

    // Rotate using workspace write key - this creates file-scoped keys
    const rotateResponse = await apiRequest('POST', `/w/${freshWorkspace.writeKey}/rotate`);
    expect(rotateResponse.status).toBe(200);
    const rotateData = await rotateResponse.json();

    // Extract new keys from URLs
    const newReadKey = rotateData.data.urls.read.split('/r/')[1];
    const newWriteKey = rotateData.data.urls.write.split('/w/')[1];

    // New read key should work
    const readResponse = await apiRequest('GET', `/r/${newReadKey}/${testFile}`);
    expect(readResponse.status).toBe(200);
    const readData = await readResponse.json();
    expect(readData.data.content).toBe('# New Key Test');

    // New write key should work
    const writeResponse = await apiRequest('PUT', `/w/${newWriteKey}/${testFile}`, {
      body: { content: '# Updated After Rotation' },
    });
    expect(writeResponse.status).toBe(200);
  });

  test('POST /w/:key/rotate returns 404 for invalid key', async () => {
    const response = await apiRequest('POST', '/w/invalid-key-format/rotate');
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.ok).toBe(false);
  });

  test('POST /r/:key/rotate returns 404 for read key', async () => {
    const response = await apiRequest('POST', `/r/${workspace.readKey}/rotate`);
    expect(response.status).toBe(404);
  });
});


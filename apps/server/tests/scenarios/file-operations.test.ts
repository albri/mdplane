/**
 * File Operations Scenario Tests
 *
 * Comprehensive tests:
 * - Create and share a single file
 * - Create and share a folder of files
 * - Append content to existing file
 * - Read full file
 * - Read last N appends
 * - Read last N lines (tail)
 * - Read file structure (heading tree)
 * - Read specific section by heading
 * - Read specific append by ID
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createTestApp } from '../helpers';
import { assertValidResponse } from '../helpers/schema-validator';
import { createTestWorkspace, createTestFile, readTestFile } from '../fixtures';

describe('File Operations Scenarios', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Create and Share Single File', () => {
    test('bootstrap workspace returns capability keys', async () => {
      // GIVEN: A fresh application
      // WHEN: Bootstrapping a new workspace
      const workspace = await createTestWorkspace(app);

      // THEN: Workspace should have all capability keys
      expect(workspace.workspaceId).toMatch(/^ws_/);
      expect(workspace.readKey).toBeDefined();
      expect(workspace.appendKey).toBeDefined();
      expect(workspace.writeKey).toBeDefined();
    });

    test('create file with PUT /w/:key/path returns file metadata', async () => {
      // GIVEN: A bootstrapped workspace
      const workspace = await createTestWorkspace(app);
      const content = '# My First File\n\nHello, world!';

      // WHEN: Creating a file via PUT
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/test-file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
      );

      // THEN: Response should be 200 with file metadata
      expect(response.ok).toBe(true);
      const body = await response.json();
      assertValidResponse(body, 'FileUpdateResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.id).toBeDefined();
      expect(data.etag).toBeDefined();
      expect(data.updatedAt).toBeDefined();
      expect(data.size).toBeGreaterThan(0);
    });

    test('read URL works (GET /r/:key/path)', async () => {
      // GIVEN: A file created in a workspace
      const workspace = await createTestWorkspace(app);
      const content = '# Test Read\n\nReading this content.';
      await createTestFile(app, workspace, '/readable.md', content);

      // WHEN: Reading the file via read key
      const response = await readTestFile(app, workspace, '/readable.md');

      // THEN: Should return file content with metadata
      expect(response.ok).toBe(true);
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.content).toBe(content);
      expect(data.id).toBeDefined();
      expect(data.filename).toBe('readable.md');
      expect(data.etag).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
      expect(data.appendCount).toBe(0);
      expect(data.size).toBe(content.length);
    });

    test('append URL works (POST /a/:key/*path)', async () => {
      // GIVEN: A file created in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/appendable.md');

      // WHEN: Appending content via append key (POST /a/:key/*path)
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'This is an appended comment.',
          }),
        })
      );

      // THEN: Should return append metadata
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.id).toMatch(/^a\d+$/);
      expect(data.author).toBe('test-user');
      expect(data.type).toBe('comment');
      expect(data.ts).toBeDefined();
    });

    test('write URL works for update (PUT /w/:key/path)', async () => {
      // GIVEN: A file created in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/updatable.md', '# Original');

      // WHEN: Updating the file via write key
      const newContent = '# Updated Content\n\nThis has been updated.';
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newContent }),
        })
      );

      // THEN: Should return updated metadata
      expect(response.ok).toBe(true);
      const body = await response.json();
      assertValidResponse(body, 'FileUpdateResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.id).toBe(file.id);
      expect(data.etag).not.toBe(file.etag);
      expect(data.updatedAt).toBeDefined();
      expect(data.size).toBe(newContent.length);
    });

    test('read and write URLs point to same file', async () => {
      // GIVEN: A file created in a workspace
      const workspace = await createTestWorkspace(app);
      const content = '# Same File Test\n\nVerifying URL consistency.';
      const file = await createTestFile(app, workspace, '/consistency.md', content);

      // WHEN: Reading via read key
      const readResponse = await readTestFile(app, workspace, file.path);
      const readBody = await readResponse.json();
      assertValidResponse(readBody, 'FileReadResponse');
      const readData = readBody.data;

      // AND: Reading via write key (write keys can read)
      const writeReadResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
          method: 'GET',
        })
      );
      const writeReadBody = await writeReadResponse.json();
      assertValidResponse(writeReadBody, 'FileReadResponse');
      const writeReadData = writeReadBody.data;

      // THEN: Both should return the same file
      expect(readData.id).toBe(file.id);
      expect(writeReadData.id).toBe(file.id);
      expect(readData.content).toBe(content);
      expect(writeReadData.content).toBe(content);
    });
  });

  describe('Create Folder with Files', () => {
    test('create folder with POST /w/:key/folders', async () => {
      // GIVEN: A bootstrapped workspace
      const workspace = await createTestWorkspace(app);

      // WHEN: Creating a folder via POST
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'my-folder' }),
        })
      );

      // THEN: Should return folder with capability URLs
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'FolderCreateResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.path).toBe('/my-folder');
      expect(data.urls).toBeDefined();
      expect(data.urls.read).toBeDefined();
      expect(data.urls.append).toBeDefined();
      expect(data.urls.write).toBeDefined();
      expect(data.createdAt).toBeDefined();
    });

    test('create file inside folder', async () => {
      // GIVEN: A workspace with a folder
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'docs' }),
        })
      );

      // WHEN: Creating a file inside the folder
      const file = await createTestFile(app, workspace, '/docs/readme.md', '# Readme\n\nDocumentation here.');

      // THEN: File should be created successfully
      expect(file.id).toBeDefined();
      expect(file.path).toBe('/docs/readme.md');
    });

    test('folder listing shows files inside', async () => {
      // GIVEN: A workspace with a folder containing files
      const workspace = await createTestWorkspace(app);
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'projects' }),
        })
      );

      // Create a file inside the folder using workspace write key
      await createTestFile(app, workspace, '/projects/task.md', '# Project Tasks');

      // WHEN: Listing folder contents with workspace read key
      const listResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/folders/projects`, {
          method: 'GET',
        })
      );

      // THEN: Should see the file in the listing
      expect(listResponse.ok).toBe(true);
      const listBody = await listResponse.json();
      assertValidResponse(listBody, 'FolderListResponse');
      const { ok, data } = listBody;
      expect(ok).toBe(true);
      expect(data.items).toBeDefined();
      const file = data.items.find((item: { name: string }) => item.name === 'task.md');
      expect(file).toBeDefined();
      expect(file.type).toBe('file');
    });
  });

  describe('Append Content', () => {
    test('POST /a/:key/*path with content returns append metadata', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/log.md', '# Activity Log');

      // WHEN: Appending content (POST /a/:key/*path)
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'alice',
            content: 'First log entry',
          }),
        })
      );

      // THEN: Response includes appendId, timestamp, author
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.id).toBe('a1'); // First append
      expect(data.author).toBe('alice');
      expect(data.ts).toBeDefined();
      expect(data.type).toBe('comment');
    });

    test('multiple appends accumulate correctly', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/multi-append.md', '# Notes');

      // WHEN: Appending multiple comments
      for (let i = 1; i <= 3; i++) {
        await app.handle(
          new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: `user${i}`,
              content: `Comment ${i}`,
            }),
          })
        );
      }

      // THEN: File should show correct append count
      const response = await readTestFile(app, workspace, file.path);
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      const { data } = body;
      expect(data.appendCount).toBe(3);
    });
  });

  describe('Read Full File', () => {
    test('GET /r/:key/*path returns complete content with metadata', async () => {
      // GIVEN: A file with content
      const workspace = await createTestWorkspace(app);
      const content = '# Full Read Test\n\nOriginal content here.';
      const file = await createTestFile(app, workspace, '/full-read.md', content);

      // WHEN: Reading the full file
      const response = await readTestFile(app, workspace, file.path);

      // THEN: Response includes original content AND all metadata
      expect(response.ok).toBe(true);
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      const { ok, data } = body;
      expect(ok).toBe(true);
      expect(data.content).toContain('# Full Read Test');
      expect(data.content).toContain('Original content here.');
      expect(data.id).toBeDefined();
      expect(data.filename).toBe('full-read.md');
      expect(data.etag).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
      expect(data.appendCount).toBe(0);
      expect(data.size).toBeGreaterThan(0);
    });

    test('file with appends shows correct append count', async () => {
      // GIVEN: A file with an append
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/with-append.md', '# With Append');

      // Add an append
      await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'reader',
            content: 'A comment on this file',
          }),
        })
      );

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, file.path);

      // THEN: Append count should be 1
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      const { data } = body;
      expect(data.appendCount).toBe(1);
    });

    test('response includes ETag header for concurrency', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/etag-test.md');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, file.path);

      // THEN: Response should have ETag header
      expect(response.headers.get('ETag')).toBeDefined();
    });
  });

  describe('Read Last N Appends', () => {
    test('file tracks append count correctly after multiple appends', async () => {
      // GIVEN: A file with 5 appends
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/many-appends.md', '# Appends Test');

      for (let i = 1; i <= 5; i++) {
        await app.handle(
          new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'tester',
              content: `Append number ${i}`,
            }),
          })
        );
      }

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, file.path);

      // THEN: Append count should be 5
      expect(response.ok).toBe(true);
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      const { data } = body;
      expect(data.appendCount).toBe(5);
    });

    test('appends are created with sequential IDs', async () => {
      // GIVEN: A file in a workspace
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/sequential-appends.md', '# Sequential');

      // WHEN: Creating 3 appends
      const appendIds: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const response = await app.handle(
          new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'tester',
              content: `Comment ${i}`,
            }),
          })
        );
        const appendBody = await response.json();
        assertValidResponse(appendBody, 'AppendResponse');
        const { data } = appendBody;
        appendIds.push(data.id);
      }

      // THEN: Append IDs should be sequential (a1, a2, a3)
      expect(appendIds[0]).toBe('a1');
      expect(appendIds[1]).toBe('a2');
      expect(appendIds[2]).toBe('a3');
    });
  });

  describe('Read Tail', () => {
    test('GET /r/:key/tail with lines returns last N lines', async () => {
      // GIVEN: A file with multiple lines
      const workspace = await createTestWorkspace(app);
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
      await createTestFile(app, workspace, 'docs/multiline.md', lines);

      // WHEN: Requesting last 5 lines via /r/:key/tail?lines=5
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/tail?lines=5`, {
          method: 'GET',
        })
      );

      // THEN: Should return the last 5 lines
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileTailResponse');
      expect(body.ok).toBe(true);
      expect(body.data.content).toContain('Line 10');
      expect(body.data.content).toContain('Line 6');
      expect(typeof body.data.bytesReturned).toBe('number');
      expect(typeof body.data.truncated).toBe('boolean');
    });

    test('GET /r/:key/tail with bytes returns last N bytes', async () => {
      // GIVEN: A file with content
      const workspace = await createTestWorkspace(app);
      const content = 'A'.repeat(200);
      await createTestFile(app, workspace, 'docs/bytefile.md', content);

      // WHEN: Requesting last 100 bytes via /r/:key/tail?bytes=100
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/tail?bytes=100`, {
          method: 'GET',
        })
      );

      // THEN: Should return approximately 100 bytes
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileTailResponse');
      expect(body.ok).toBe(true);
      expect(body.data.bytesReturned).toBeLessThanOrEqual(100);
      expect(typeof body.data.content).toBe('string');
      expect(body.data.truncated).toBe(true);
    });
  });

  describe('Read Heading Tree', () => {
    test('GET /r/:key/structure returns heading tree', async () => {
      // GIVEN: A workspace with a file containing nested headings
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, 'docs/guide.md',
        '# Introduction\n\nSome intro text.\n\n## Getting Started\n\nHow to start.\n\n### Prerequisites\n\nWhat you need.\n\n## Advanced Topics\n\nFor experts.'
      );

      // WHEN: Reading the structure via /r/:key/structure
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/structure`, {
          method: 'GET',
        })
      );

      // THEN: Should return heading tree reflecting document hierarchy
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileStructureResponse');
      expect(body.ok).toBe(true);
      expect(body.data.headings).toBeDefined();
      expect(Array.isArray(body.data.headings)).toBe(true);
      expect(body.data.headings.length).toBe(4);

      // Verify heading structure
      expect(body.data.headings[0].level).toBe(1);
      expect(body.data.headings[0].text).toBe('Introduction');
      expect(body.data.headings[1].level).toBe(2);
      expect(body.data.headings[1].text).toBe('Getting Started');
      expect(body.data.headings[2].level).toBe(3);
      expect(body.data.headings[2].text).toBe('Prerequisites');
      expect(body.data.headings[3].level).toBe(2);
      expect(body.data.headings[3].text).toBe('Advanced Topics');
    });

    test('heading tree includes level and line number', async () => {
      // GIVEN: A file with headings at specific lines
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, 'docs/test.md',
        '# Title\nContent line 2\n## Section\nContent line 4\n\n\n# Another Title'
      );

      // WHEN: Reading structure
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/structure`, {
          method: 'GET',
        })
      );

      // THEN: Each heading has level, text, and line
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileStructureResponse');
      expect(body.ok).toBe(true);

      const headings = body.data.headings;
      expect(headings.length).toBe(3);

      // Verify each heading has required fields
      for (const heading of headings) {
        expect(typeof heading.level).toBe('number');
        expect(heading.level).toBeGreaterThanOrEqual(1);
        expect(heading.level).toBeLessThanOrEqual(6);
        expect(typeof heading.text).toBe('string');
        expect(typeof heading.line).toBe('number');
        expect(heading.line).toBeGreaterThanOrEqual(1);
      }

      // Verify specific line numbers (1-based)
      expect(headings[0].line).toBe(1);  // # Title
      expect(headings[1].line).toBe(3);  // ## Section
      expect(headings[2].line).toBe(7);  // # Another Title
    });

    test('file with no headings returns empty array', async () => {
      // GIVEN: A file without any headings
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, 'docs/plain.md',
        'Just plain text.\n\nNo headings here.\n\nMore content.'
      );

      // WHEN: Reading structure
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/structure`, {
          method: 'GET',
        })
      );

      // THEN: Should return empty headings array
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileStructureResponse');
      expect(body.ok).toBe(true);
      expect(body.data.headings).toEqual([]);
      expect(typeof body.data.appendCount).toBe('number');
      expect(typeof body.data.hasTaskAppends).toBe('boolean');
    });
  });

  describe('Read Section by Heading', () => {
    test('GET /r/:key/section/:heading returns section content', async () => {
      // GIVEN: A file with multiple sections
      const workspace = await createTestWorkspace(app);
      await createTestFile(
        app,
        workspace,
        'docs/manual.md',
        '# Getting Started\n\nIntro text.\n\n## Installation\n\nInstall steps here.\n\n## Configuration\n\nConfig info.'
      );

      // WHEN: Reading the "Installation" section via /r/:key/section/Installation
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/section/Installation`, {
          method: 'GET',
        })
      );

      // THEN: Should return the section content
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileSectionResponse');
      expect(body.ok).toBe(true);
      expect(body.data.heading).toBe('Installation');
      expect(body.data.level).toBe(2);
      expect(body.data.content).toContain('Install steps here.');
      expect(typeof body.data.startLine).toBe('number');
      expect(typeof body.data.endLine).toBe('number');
    });

    test('section includes content until next same-level heading', async () => {
      // GIVEN: A file with sections at same level
      const workspace = await createTestWorkspace(app);
      await createTestFile(
        app,
        workspace,
        'docs/parts.md',
        '# Document\n\n## Part One\n\nPart one content.\n\nMore part one.\n\n## Part Two\n\nPart two content.'
      );

      // WHEN: Reading "Part One"
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/section/Part%20One`, {
          method: 'GET',
        })
      );

      // THEN: Content should include Part One but not Part Two
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileSectionResponse');
      expect(body.ok).toBe(true);
      expect(body.data.content).toContain('Part one content.');
      expect(body.data.content).toContain('More part one.');
      expect(body.data.content).not.toContain('Part two content.');
    });

    test('section not found returns 404', async () => {
      // GIVEN: A file without a matching section
      const workspace = await createTestWorkspace(app);
      await createTestFile(app, workspace, 'docs/nosection.md', '# Title\n\nNo sections here.');

      // WHEN: Requesting a non-existent section
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/section/NonExistent`, {
          method: 'GET',
        })
      );

      // THEN: Should return 404
      expect(response.status).toBe(404);
    });
  });

  describe('Read Specific Append by ID', () => {
    test('GET /r/:key/ops/file/append/:appendId returns specific append', async () => {
      // GIVEN: A file with multiple appends
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, 'docs/appends.md', '# Appends File');

      // Create two appends
      await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'comment', author: 'alice', content: 'First comment' }),
        })
      );
      await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'comment', author: 'bob', content: 'Second comment' }),
        })
      );

      // WHEN: Reading specific append a2 via /r/:key/ops/file/append/a2
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/ops/file/append/a2`, {
          method: 'GET',
        })
      );

      // THEN: Should return the specific append object with metadata
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'ReadAppendResponse');
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe('a2');
      expect(body.data.author).toBe('bob');
      expect(body.data.content).toBe('Second comment');
    });

    test('append not found returns 404', async () => {
      // GIVEN: A file with only one append
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, 'docs/oneappend.md', '# One Append');

      await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'comment', author: 'alice', content: 'Only comment' }),
        })
      );

      // WHEN: Requesting non-existent append a99
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/ops/file/append/a99`, {
          method: 'GET',
        })
      );

      // THEN: Should return 404
      expect(response.status).toBe(404);
    });

    test('returns single append object with full metadata', async () => {
      // GIVEN: A file with a task append
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, 'docs/taskappend.md', '# Task File');

      await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'jordan',
            content: 'Important task to complete',
          }),
        })
      );

      // WHEN: Reading the task append via /r/:key/ops/file/append/a1
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/ops/file/append/a1`, {
          method: 'GET',
        })
      );

      // THEN: Should include all task metadata
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'ReadAppendResponse');
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe('a1');
      expect(body.data.author).toBe('jordan');
      expect(body.data.type).toBe('task');
      expect(body.data.content).toBe('Important task to complete');
      expect(body.data.ts).toBeDefined();
    });
  });
});



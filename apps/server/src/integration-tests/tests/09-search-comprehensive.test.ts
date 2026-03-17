/**
 * Comprehensive Search Integration Tests
 *
 * Tests FTS5 search functionality including:
 * - File content search (markdown)
 * - Append content search
 * - Snippet/highlight generation
 * - Deleted file exclusion
 * - Scope constraints (file/folder/workspace)
 * - Pagination
 * - Filters (type, status, author)
 * - Ranking/relevance
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';
import { createUserWithSession, getAuthHeaders } from '../helpers/mock-oauth';
import { linkUserToWorkspace } from '../fixtures/workspaces';

describe('09 - Search - Comprehensive FTS5 Tests', () => {
  let workspace: BootstrappedWorkspace;
  let folderName: string;
  let sessionToken: string;
  let userId: string;
  const files: Record<string, string> = {};

  beforeAll(async () => {
    const userSession = await createUserWithSession('test-search@integration.test');
    sessionToken = userSession.sessionToken;
    userId = userSession.userId;

    workspace = await bootstrap();
    await linkUserToWorkspace({ userId, workspaceId: workspace.workspaceId });
    folderName = uniqueName('fts_test');

    // Create test folder
    await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
      body: { name: folderName },
    });

    // Create files with unique content for specific test scenarios
    files.markdownContent = uniqueName('markdown_content');
    await apiRequest('PUT', `/w/${workspace.writeKey}/${folderName}/markdown-file.md`, {
      body: { content: `# Heading\n\nThis is a paragraph with ${files.markdownContent} token.\n\n## Section\n\nMore content here.` },
    });

    files.codeContent = uniqueName('code_content');
    await apiRequest('PUT', `/w/${workspace.writeKey}/${folderName}/code.ts`, {
      body: { content: `function test() {\n  return '${files.codeContent}';\n}` },
    });

    files.toBeDeleted = uniqueName('to_be_deleted');
    await apiRequest('PUT', `/w/${workspace.writeKey}/${folderName}/deleted.md`, {
      body: { content: `This file will be deleted: ${files.toBeDeleted}` },
    });

    // Create appends with searchable content
    files.taskContent = uniqueName('task_content');
    await apiRequest('POST', `/a/${workspace.appendKey}/${folderName}/markdown-file.md`, {
      body: {
        author: 'test-agent',
        type: 'task',
        content: `Task containing ${files.taskContent}`,
      },
    });

    files.commentContent = uniqueName('comment_content');
    await apiRequest('POST', `/a/${workspace.appendKey}/${folderName}/markdown-file.md`, {
      body: {
        author: 'test-user',
        type: 'comment',
        content: `Comment with ${files.commentContent}`,
      },
    });

    // Create a claim append
    files.claimContent = uniqueName('claim_content');
    const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${folderName}/markdown-file.md`, {
      body: {
        author: 'test-agent',
        type: 'task',
        content: `Task for claim: ${files.claimContent}`,
      },
    });
    const taskData = await taskRes.json();
    const taskId = taskData.data?.id || taskData.data?.appendId;

    if (taskId) {
      await apiRequest('POST', `/a/${workspace.appendKey}/${folderName}/markdown-file.md`, {
        body: {
          author: 'test-agent',
          type: 'claim',
          ref: taskId,
          content: `Claim on task: ${files.claimContent}`,
        },
      });
    }

    // Delete one file to test exclusion
    await apiRequest('DELETE', `/w/${workspace.writeKey}/${folderName}/deleted.md`);
  });

  describe('File Content Search', () => {
    test('finds content in markdown files', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.markdownContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const fileResults = data.data.results.filter((r: { type: string }) => r.type === 'file');
      expect(fileResults.length).toBeGreaterThan(0);
      expect(fileResults.some((r: { file?: { path: string } }) =>
        r.file?.path?.includes('markdown-file.md')
      )).toBe(true);
    });

    test('finds content in code files', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.codeContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const fileResults = data.data.results.filter((r: { type: string }) => r.type === 'file');
      expect(fileResults.length).toBeGreaterThan(0);
      expect(fileResults.some((r: { file?: { path: string } }) =>
        r.file?.path?.includes('code.ts')
      )).toBe(true);
    });

    test('returns snippets containing the search term', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.markdownContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const fileResult = data.data.results.find((r: { type: string }) => r.type === 'file');
      expect(fileResult).toBeDefined();
      expect(fileResult.content).toBeDefined();
      // Snippet MUST contain the actual search term (case-insensitive)
      expect(fileResult.content.toLowerCase()).toContain(files.markdownContent.toLowerCase());
    });

    test('excludes soft-deleted files from results', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.toBeDeleted}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const hasDeletedFile = data.data.results.some((r: { file?: { path: string } }) =>
        r.file?.path?.includes('deleted.md')
      );
      expect(hasDeletedFile).toBe(false);
    });
  });

  describe('Append Content Search', () => {
    test('finds task appends', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.taskContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const taskResults = data.data.results.filter((r: { type: string }) => r.type === 'task');
      expect(taskResults.length).toBeGreaterThan(0);
    });

    test('finds comment appends', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.commentContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const appendResults = data.data.results.filter((r: { type: string }) => r.type === 'append');
      expect(appendResults.length).toBeGreaterThan(0);
    });

    test('finds claim appends', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.claimContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const claimResults = data.data.results.filter((r: { type: string }) => r.type === 'claim' || r.type === 'task');
      expect(claimResults.length).toBeGreaterThan(0);
    });

    test('appends include author information', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.taskContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const appendResult = data.data.results.find((r: { type: string }) =>
        r.type === 'task' || r.type === 'append'
      );
      expect(appendResult).toBeDefined();
      expect(appendResult.author).toBeDefined();
    });
  });

  describe('Search Scoping', () => {
    test('respects folder scope in capability URLs', async () => {
      // Create a file outside the test folder
      const outsideToken = uniqueName('outside_folder');
      await apiRequest('PUT', `/w/${workspace.writeKey}/outside.md`, {
        body: { content: `Outside content: ${outsideToken}` },
      });

      // Search within folder scope should not find outside file
      const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/search?path=${folderName}&q=${outsideToken}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const hasOutsideFile = data.data.results.some((r: { file?: { path: string } }) =>
        r.file?.path === '/outside.md'
      );
      expect(hasOutsideFile).toBe(false);
    });

    test('workspace-wide search finds all files', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.markdownContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      // Should find the markdown file
      expect(data.data.results.some((r: { file?: { path: string } }) =>
        r.file?.path?.includes('markdown-file.md')
      )).toBe(true);
    });
  });

  describe('Search Filters', () => {
    test('filters by append type', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.taskContent}&type=task`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const nonTaskResults = data.data.results.filter((r: { type: string }) =>
        r.type !== 'task' && r.type !== 'file'
      );
      expect(nonTaskResults.length).toBe(0);
    });

    test('filters by author', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.commentContent}&author=test-user`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const wrongAuthorResults = data.data.results.filter((r: { author?: string }) =>
        r.author && r.author !== 'test-user'
      );
      expect(wrongAuthorResults.length).toBe(0);
    });
  });

  describe('Pagination', () => {
    test('respects limit parameter', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=content&limit=2`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.data.results.length).toBeLessThanOrEqual(2);
    });

    test('returns pagination metadata', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=content&limit=2`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.hasMore).toBe('boolean');
    });
  });

  describe('Search Result Structure', () => {
    test('returns correct result fields', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.markdownContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.data.results.length).toBeGreaterThan(0);
      const result = data.data.results[0];

      expect(result.id).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.file).toBeDefined();
      expect(result.file.path).toBeDefined();
    });

    test('returns highlights for matches', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.markdownContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const result = data.data.results[0];
      expect(result.highlights).toBeDefined();
      expect(Array.isArray(result.highlights)).toBe(true);
    });
  });

  describe('API Key Workspace Search', () => {
    test('API key can search entire workspace', async () => {
      // Create API key first (requires session auth)
      const apiKeyRes = await apiRequest('POST', `/workspaces/${workspace.workspaceId}/api-keys`, {
        headers: getAuthHeaders(sessionToken),
        body: {
          name: 'Search Test Key',
          permissions: ['read'],
        },
      });
      expect(apiKeyRes.ok).toBe(true);
      const apiKeyData = await apiKeyRes.json();
      const apiKey = apiKeyData.data?.key;

      expect(apiKey).toBeDefined();

      // Search using API key
      const response = await apiRequest('GET', `/api/v1/search?q=${files.markdownContent}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.data.results.length).toBeGreaterThan(0);
    });
  });

  describe('Snippet Accuracy Validation', () => {
    test('highlight positions correctly identify search term location in content', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.markdownContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const fileResult = data.data.results.find((r: { type: string }) => r.type === 'file');
      expect(fileResult).toBeDefined();
      expect(fileResult.highlights).toBeDefined();
      expect(fileResult.highlights.length).toBeGreaterThan(0);

      // Verify highlight positions are accurate
      for (const highlight of fileResult.highlights) {
        expect(typeof highlight.start).toBe('number');
        expect(typeof highlight.end).toBe('number');
        expect(highlight.start).toBeGreaterThanOrEqual(0);
        expect(highlight.end).toBeGreaterThan(highlight.start);

        // Extract the highlighted portion from content and verify it matches the search term
        const highlightedText = fileResult.content.substring(highlight.start, highlight.end);
        expect(highlightedText.toLowerCase()).toBe(files.markdownContent.toLowerCase());
      }
    });

    test('snippet contains actual search term (not just ellipsis)', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${files.markdownContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const fileResult = data.data.results.find((r: { type: string }) => r.type === 'file');
      expect(fileResult).toBeDefined();

      // Content MUST contain the search term, not just ellipsis
      expect(fileResult.content.toLowerCase()).toContain(files.markdownContent.toLowerCase());
    });

    test('multiple highlights for repeated terms are all accurate', async () => {
      // Create file with repeated search term
      const repeatedTerm = uniqueName('repeated');
      await apiRequest('PUT', `/w/${workspace.writeKey}/${folderName}/repeated-terms.md`, {
        body: { content: `${repeatedTerm} appears first, then ${repeatedTerm} again, and ${repeatedTerm} third time.` },
      });

      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${repeatedTerm}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const result = data.data.results.find((r: { file?: { path: string } }) =>
        r.file?.path?.includes('repeated-terms.md')
      );
      expect(result).toBeDefined();

      // Each highlight should point to the exact search term
      for (const highlight of result.highlights || []) {
        const extracted = result.content.substring(highlight.start, highlight.end);
        expect(extracted.toLowerCase()).toBe(repeatedTerm.toLowerCase());
      }
    });
  });

  describe('Query Injection Prevention', () => {
    test('FTS5 operators are escaped and treated as literal text', async () => {
      // Try to inject FTS5 operators - these should be escaped
      const injectionAttempts = [
        'test OR 1=1',
        'test AND DROP',
        '"test" OR "admin"',
        'test*',
        'test NEAR/5 password',
        '-test',
        'test:content',
      ];

      for (const injection of injectionAttempts) {
        const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${encodeURIComponent(injection)}`);
        // Should not crash or error - query is sanitized
        expect(response.ok).toBe(true);
        const data = await response.json();
        // Response should be valid search result structure
        expect(data.data).toBeDefined();
        expect(Array.isArray(data.data.results)).toBe(true);
      }
    });

    test('quotes in search terms are properly escaped', async () => {
      // Create file with quotes in content
      const quotedContent = uniqueName('quoted');
      await apiRequest('PUT', `/w/${workspace.writeKey}/${folderName}/quotes-file.md`, {
        body: { content: `This contains "quoted ${quotedContent}" text inside.` },
      });

      // Search for term with quotes - should not break query
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${encodeURIComponent(`"${quotedContent}"`)}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data.data.results)).toBe(true);
    });

    test('malformed FTS5 syntax does not cause server errors', async () => {
      const malformed = [
        '(((',
        '))))',
        'AND AND AND',
        'OR OR OR',
        '""""""',
        '\\\\\\',
      ];

      for (const query of malformed) {
        const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${encodeURIComponent(query)}`);
        // Should handle gracefully - either return results or empty, not 500
        expect(response.status).not.toBe(500);
        if (response.ok) {
          const data = await response.json();
          expect(data.data).toBeDefined();
        }
      }
    });
  });

  describe('Edge Cases', () => {
    test('search with empty query returns appropriate response', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=`);
      // Should handle empty query - either error or empty results
      expect([200, 400]).toContain(response.status);
    });

    test('search with very long query is handled', async () => {
      const longQuery = 'a'.repeat(1000);
      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${longQuery}`);
      // Should handle gracefully - either truncate or error
      expect([200, 400, 413]).toContain(response.status);
    });

    test('search with unicode characters works correctly', async () => {
      const unicodeContent = uniqueName('unicode');
      await apiRequest('PUT', `/w/${workspace.writeKey}/${folderName}/unicode-file.md`, {
        body: { content: `Unicode test: ${unicodeContent} 你好世界 🚀 émojis` },
      });

      const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${unicodeContent}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.data.results.some((r: { file?: { path: string } }) =>
        r.file?.path?.includes('unicode-file.md')
      )).toBe(true);
    });

    test('search in workspace with no files returns empty results', async () => {
      // Create a new empty workspace
      const emptyWorkspace = await bootstrap();

      const response = await apiRequest('GET', `/r/${emptyWorkspace.readKey}/search?q=test`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.data.results).toEqual([]);
    });
  });

  describe('Race Conditions', () => {
    test('search returns consistent results when file is deleted concurrently', async () => {
      // Create a file with unique searchable content
      const raceToken = uniqueName('race_condition');
      await apiRequest('PUT', `/w/${workspace.writeKey}/${folderName}/race-file.md`, {
        body: { content: `Race condition test with ${raceToken} content` },
      });

      // Start search and delete concurrently
      const searchPromise = apiRequest('GET', `/r/${workspace.readKey}/search?q=${raceToken}`);
      const deletePromise = apiRequest('DELETE', `/w/${workspace.writeKey}/${folderName}/race-file.md`);

      const [searchResponse, deleteResponse] = await Promise.all([searchPromise, deletePromise]);

      // Both operations should complete without errors
      expect(searchResponse.ok).toBe(true);
      expect(deleteResponse.ok).toBe(true);

      // Search results should be valid (either include file or not, but not error)
      const searchData = await searchResponse.json();
      expect(Array.isArray(searchData.data.results)).toBe(true);

      // Subsequent search should NOT return the deleted file
      const afterDeleteSearch = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${raceToken}`);
      expect(afterDeleteSearch.ok).toBe(true);
      const afterDeleteData = await afterDeleteSearch.json();
      const hasDeletedFile = afterDeleteData.data.results.some((r: { file?: { path: string } }) =>
        r.file?.path?.includes('race-file.md')
      );
      expect(hasDeletedFile).toBe(false);
    });

    test('multiple concurrent searches return consistent results', async () => {
      // Create a file with searchable content
      const concurrentToken = uniqueName('concurrent');
      await apiRequest('PUT', `/w/${workspace.writeKey}/${folderName}/concurrent-test.md`, {
        body: { content: `Testing concurrent searches with ${concurrentToken}` },
      });

      // Run 5 concurrent searches
      const searchPromises = Array(5).fill(null).map(() =>
        apiRequest('GET', `/r/${workspace.readKey}/search?q=${concurrentToken}`)
      );

      const responses = await Promise.all(searchPromises);

      // All should succeed
      for (const response of responses) {
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(Array.isArray(data.data.results)).toBe(true);
        // All should find the file
        expect(data.data.results.some((r: { file?: { path: string } }) =>
          r.file?.path?.includes('concurrent-test.md')
        )).toBe(true);
      }
    });
  });
});



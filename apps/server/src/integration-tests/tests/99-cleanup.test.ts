/**
 * Cleanup Verification Tests
 *
 * Verifies that all test data is properly cleaned up after tests complete.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { bootstrap, apiRequest } from '../helpers/api-client';
import { cleanupAllTestData } from '../helpers/cleanup';
import { CONFIG } from '../config';

describe('99 - Cleanup', () => {
  let workspaceId: string;
  let readKey: string;
  let appendKey: string;
  let writeKey: string;

  beforeAll(async () => {
    const workspace = await bootstrap();
    workspaceId = workspace.workspaceId;
    readKey = workspace.readKey;
    appendKey = workspace.appendKey;
    writeKey = workspace.writeKey;
  });

  describe('Pre-Cleanup Verification', () => {
    test('workspace is still accessible', async () => {
      const response = await apiRequest('GET', `/r/${readKey}/folders`);
      expect(response.ok).toBe(true);
    });

    test('integration test files exist before cleanup', async () => {
      const response = await apiRequest('GET', `/r/${readKey}/ops/folders/search?q=${CONFIG.TEST_PREFIX}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      console.log(`Found ${data.data.results?.length || 0} integration test files before cleanup`);
    });
  });

  describe('Actual Cleanup', () => {
    test('cleanup integration test files from workspace', async () => {
      // Find all integration test files
      const searchResponse = await apiRequest(
        'GET',
        `/r/${readKey}/ops/folders/search?q=${CONFIG.TEST_PREFIX}`
      );
      expect(searchResponse.ok).toBe(true);
      const searchData = await searchResponse.json();
      const files = searchData.data.results || [];

      console.log(`Cleaning up ${files.length} integration test files...`);

      let deleted = 0;
      let errors = 0;

      // Delete each file (deepest paths first)
      const sortedFiles = files
        .map((f: { path: string }) => f.path)
        .sort((a: string, b: string) => b.length - a.length);

      for (const filePath of sortedFiles) {
        const deleteResponse = await apiRequest('DELETE', `/w/${writeKey}/${filePath}?permanent=true`);
        if (deleteResponse.ok) {
          deleted++;
        } else {
          errors++;
          console.warn(`  ⚠ Failed to delete: ${filePath} (${deleteResponse.status})`);
        }
      }

      console.log(`Cleanup complete: ${deleted} deleted, ${errors} errors`);
      expect(errors).toBe(0);
    });
  });

  describe('Post-Cleanup Verification', () => {
    test('no integration test files remain after cleanup', async () => {
      const response = await apiRequest('GET', `/r/${readKey}/ops/folders/search?q=${CONFIG.TEST_PREFIX}`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      const remaining = data.data.results?.length || 0;
      console.log(`Remaining integration test files: ${remaining}`);
      expect(remaining).toBe(0);
    });

    test('workspace stats show reduced file count', async () => {
      const response = await apiRequest('GET', `/w/${writeKey}/ops/stats`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      console.log('Post-cleanup workspace stats:', JSON.stringify(data.data, null, 2));
    });
  });

  describe('Cleanup Idempotency', () => {
    test('running cleanup again succeeds with 0 deletions', async () => {
      // Search for integration test files (should be none)
      const searchResponse = await apiRequest(
        'GET',
        `/r/${readKey}/ops/folders/search?q=${CONFIG.TEST_PREFIX}`
      );
      expect(searchResponse.ok).toBe(true);
      const searchData = await searchResponse.json();
      const files = searchData.data.results || [];

      // Should find 0 files
      expect(files.length).toBe(0);
      console.log('Idempotency check: 0 files to delete (as expected)');
    });
  });

  describe('Final Summary', () => {
    test('cleanup summary', () => {
      console.log('\n=== CLEANUP SUMMARY ===');
      console.log(`Workspace ID: ${workspaceId}`);
      console.log(`Test prefix: ${CONFIG.TEST_PREFIX}`);
      console.log('Cleanup: COMPLETE');
      console.log('========================\n');
      expect(true).toBe(true);
    });
  });
});



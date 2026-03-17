/**
 * Webhook Scope Matching Tests
 *
 * Tests for folder scope matching with recursive/non-recursive semantics.
 * Ensures isPathInScope correctly handles direct-child-only matching.
 */

import { describe, expect, test } from 'bun:test';
import { isPathInScope } from '../webhook-scope';

describe('Webhook Scope Matching', () => {
  describe('Workspace scope', () => {
    test('matches all files', () => {
      expect(isPathInScope('/any/path/file.md', 'workspace', null)).toBe(true);
      expect(isPathInScope('/root.md', 'workspace', null)).toBe(true);
    });
  });

  describe('File scope', () => {
    test('matches exact file path only', () => {
      expect(isPathInScope('/docs/readme.md', 'file', '/docs/readme.md')).toBe(true);
      expect(isPathInScope('/docs/other.md', 'file', '/docs/readme.md')).toBe(false);
    });
  });

  describe('Folder scope - recursive=true (default)', () => {
    test('matches files in folder', () => {
      expect(isPathInScope('/docs/readme.md', 'folder', '/docs', true)).toBe(true);
    });

    test('matches files in nested subfolders', () => {
      expect(isPathInScope('/docs/guides/intro.md', 'folder', '/docs', true)).toBe(true);
      expect(isPathInScope('/docs/guides/api/endpoints.md', 'folder', '/docs', true)).toBe(true);
    });

    test('does NOT match files outside folder', () => {
      expect(isPathInScope('/docstring.md', 'folder', '/docs', true)).toBe(false);
      expect(isPathInScope('/docs2/file.md', 'folder', '/docs', true)).toBe(false);
    });

    test('handles trailing slash in scope', () => {
      expect(isPathInScope('/docs/readme.md', 'folder', '/docs/', true)).toBe(true);
    });
  });

  describe('Folder scope - recursive=false (direct children only)', () => {
    test('matches direct children', () => {
      expect(isPathInScope('/docs/readme.md', 'folder', '/docs', false)).toBe(true);
      expect(isPathInScope('/docs/api.md', 'folder', '/docs', false)).toBe(true);
    });

    test('does NOT match nested files', () => {
      expect(isPathInScope('/docs/guides/intro.md', 'folder', '/docs', false)).toBe(false);
      expect(isPathInScope('/docs/guides/api/endpoints.md', 'folder', '/docs', false)).toBe(false);
    });

    test('does NOT match files outside folder', () => {
      expect(isPathInScope('/docstring.md', 'folder', '/docs', false)).toBe(false);
      expect(isPathInScope('/docs2/file.md', 'folder', '/docs', false)).toBe(false);
    });
  });

  describe('Root folder scope', () => {
    test('recursive=true matches all files', () => {
      expect(isPathInScope('/readme.md', 'folder', '/', true)).toBe(true);
      expect(isPathInScope('/docs/readme.md', 'folder', '/', true)).toBe(true);
      expect(isPathInScope('/a/b/c/d.md', 'folder', '/', true)).toBe(true);
    });

    test('recursive=false matches only root-level files', () => {
      expect(isPathInScope('/readme.md', 'folder', '/', false)).toBe(true);
      expect(isPathInScope('/config.json', 'folder', '/', false)).toBe(true);
      expect(isPathInScope('/docs/readme.md', 'folder', '/', false)).toBe(false);
    });

    test('handles empty string as root', () => {
      expect(isPathInScope('/readme.md', 'folder', '', true)).toBe(true);
      expect(isPathInScope('/docs/readme.md', 'folder', '', false)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('null scopePath returns false for non-workspace', () => {
      expect(isPathInScope('/file.md', 'folder', null)).toBe(false);
      expect(isPathInScope('/file.md', 'file', null)).toBe(false);
    });

    test('unknown scopeType returns false', () => {
      expect(isPathInScope('/file.md', 'unknown', '/docs')).toBe(false);
    });
  });
});


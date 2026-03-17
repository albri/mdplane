import { describe, expect, test } from 'bun:test';
import { matchesScope } from '../fixtures/websocket-state-fixtures';

describe('Scope Filtering Correctness', () => {
  describe('matchesScope', () => {
    test('root scope "/" should match all paths', () => {
      expect(matchesScope('/foo', '/')).toBe(true);
      expect(matchesScope('/bar/baz', '/')).toBe(true);
      expect(matchesScope('/projects/alpha/file.md', '/')).toBe(true);
    });

    test('empty scope should match all paths', () => {
      expect(matchesScope('/foo', '')).toBe(true);
      expect(matchesScope('/bar/baz', '')).toBe(true);
    });

    test('nested scope should only match paths under that scope', () => {
      expect(matchesScope('/projects/alpha/file.md', '/projects/')).toBe(true);
      expect(matchesScope('/projects/beta', '/projects/')).toBe(true);
      expect(matchesScope('/other/file.md', '/projects/')).toBe(false);
      expect(matchesScope('/projectsX/file.md', '/projects/')).toBe(false);
    });

    test('scope without trailing slash should match exact prefix', () => {
      expect(matchesScope('/foo/bar', '/foo')).toBe(true);
      expect(matchesScope('/foobar', '/foo')).toBe(true);
    });

    test('scope with trailing slash should only match directory contents', () => {
      expect(matchesScope('/foo/bar', '/foo/')).toBe(true);
      expect(matchesScope('/foobar', '/foo/')).toBe(false);
    });

    test('exact path match', () => {
      expect(matchesScope('/foo', '/foo')).toBe(true);
      expect(matchesScope('/foo/', '/foo/')).toBe(true);
    });

    test('scope "/projects/" should NOT receive events for "/other/"', () => {
      expect(matchesScope('/other/file.md', '/projects/')).toBe(false);
      expect(matchesScope('/other/nested/file.md', '/projects/')).toBe(false);
    });
  });
});




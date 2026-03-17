import { describe, it, expect } from 'bun:test';
import {
  validatePath,
  normalizePath,
  normalizeFolderPath,
  isPathWithinScope,
  hasPathTraversal,
  LIMITS,
} from '../path-validation';

describe('path-validation', () => {
  describe('validatePath', () => {
    it('should accept valid paths', () => {
      expect(validatePath('/docs/readme.md')).toBeNull();
      expect(validatePath('/foo/bar/baz.txt')).toBeNull();
      expect(validatePath('/')).toBeNull();
      expect(validatePath('/a')).toBeNull();
    });

    it('should reject null bytes (%00)', () => {
      const result = validatePath('/docs/%00/readme.md');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('null bytes');
    });

    it('should reject null bytes (\\0)', () => {
      const result = validatePath('/docs/\0/readme.md');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('null bytes');
    });

    it('should reject CRLF characters (%0D%0A)', () => {
      const result = validatePath('/docs/%0D%0Ainjected.md');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('CRLF');
    });

    it('should reject CRLF characters (raw)', () => {
      const result = validatePath('/docs/\r\ninjected.md');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('CRLF');
    });

    it('should reject .. traversal', () => {
      const result = validatePath('/docs/../etc/passwd');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('traversal');
    });

    it('should reject URL-encoded traversal (%2e%2e)', () => {
      const result = validatePath('/docs/%2e%2e/etc/passwd');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('traversal');
    });

    it('should reject URL-encoded traversal (%2E%2E)', () => {
      const result = validatePath('/docs/%2E%2E/etc/passwd');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('traversal');
    });

    it('should reject path exceeding max length', () => {
      const longPath = '/' + 'a'.repeat(LIMITS.PATH_MAX_LENGTH + 1);
      const result = validatePath(longPath);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('maximum length');
    });

    it('should reject filename exceeding max length', () => {
      const longFilename = '/' + 'a'.repeat(LIMITS.FILENAME_MAX_LENGTH + 1) + '.md';
      const result = validatePath(longFilename);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('Filename exceeds');
    });

    it('should reject invalid URL encoding', () => {
      const result = validatePath('/docs/%ZZ/readme.md');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PATH');
      expect(result?.message).toContain('URL encoding');
    });
  });

  describe('normalizePath', () => {
    it('should add leading slash if missing', () => {
      expect(normalizePath('docs/readme.md')).toBe('/docs/readme.md');
    });

    it('should remove trailing slash', () => {
      expect(normalizePath('/docs/')).toBe('/docs');
    });

    it('should not remove trailing slash from root', () => {
      expect(normalizePath('/')).toBe('/');
    });

    it('should collapse multiple slashes', () => {
      expect(normalizePath('/docs//readme.md')).toBe('/docs/readme.md');
      expect(normalizePath('///docs///readme.md')).toBe('/docs/readme.md');
    });

    it('should decode URL encoding', () => {
      expect(normalizePath('/docs/hello%20world.md')).toBe('/docs/hello world.md');
    });
  });

  describe('normalizeFolderPath', () => {
    it('should add leading slash if missing', () => {
      expect(normalizeFolderPath('docs')).toBe('/docs/');
    });

    it('should ensure trailing slash', () => {
      expect(normalizeFolderPath('/docs')).toBe('/docs/');
    });

    it('should handle root path', () => {
      expect(normalizeFolderPath('/')).toBe('/');
    });

    it('should collapse multiple slashes', () => {
      expect(normalizeFolderPath('//docs//subdir//')).toBe('/docs/subdir/');
    });
  });

  describe('isPathWithinScope', () => {
    it('should return true for path within scope', () => {
      expect(isPathWithinScope('/docs/readme.md', '/docs/')).toBe(true);
      expect(isPathWithinScope('/docs/sub/file.md', '/docs/')).toBe(true);
    });

    it('should return true for exact directory match', () => {
      expect(isPathWithinScope('/docs', '/docs/')).toBe(true);
    });

    it('should return false for path outside scope', () => {
      expect(isPathWithinScope('/other/readme.md', '/docs/')).toBe(false);
    });

    it('should handle scope without trailing slash', () => {
      expect(isPathWithinScope('/docs/readme.md', '/docs')).toBe(true);
    });

    it('should not match partial directory names', () => {
      expect(isPathWithinScope('/docs-backup/readme.md', '/docs/')).toBe(false);
    });
  });

  describe('hasPathTraversal', () => {
    it('should detect .. traversal', () => {
      expect(hasPathTraversal('/docs/../etc')).toBe(true);
    });

    it('should detect %2e%2e traversal', () => {
      expect(hasPathTraversal('/docs/%2e%2e/etc')).toBe(true);
    });

    it('should detect %2E%2E traversal', () => {
      expect(hasPathTraversal('/docs/%2E%2E/etc')).toBe(true);
    });

    it('should return false for clean paths', () => {
      expect(hasPathTraversal('/docs/readme.md')).toBe(false);
    });
  });
});


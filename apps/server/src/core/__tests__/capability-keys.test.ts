import { describe, expect, test } from 'bun:test';

// Import the module under test
import {
  generateKey,
  generateScopedKey,
  generateApiKey,
  validateKey,
  secureCompare,
  hashKey,
  BASE62_ALPHABET,
  KEY_PATTERNS,
} from '../capability-keys';

// Constants for testing
const BASE62_REGEX = /^[A-Za-z0-9]+$/;
const MIN_ROOT_KEY_LENGTH = 22;
const MIN_SCOPED_SUFFIX_LENGTH = 20;
const MIN_API_SUFFIX_LENGTH = 20;

describe('Capability Key System', () => {
  describe('generateKey()', () => {
    test('should generate a string of minimum 22 characters', () => {
      const key = generateKey();
      expect(key.length).toBeGreaterThanOrEqual(MIN_ROOT_KEY_LENGTH);
    });

    test('should use only base62 characters (A-Za-z0-9)', () => {
      const key = generateKey();
      expect(key).toMatch(BASE62_REGEX);
    });

    test('should generate different keys on each call', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });

    test('should generate 1000 unique keys (entropy test)', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        keys.add(generateKey());
      }
      expect(keys.size).toBe(1000);
    });

    test('should accept optional length parameter', () => {
      const key = generateKey(30);
      expect(key.length).toBe(30);
    });

    test('should enforce minimum length of 22 even if lower value passed', () => {
      const key = generateKey(10);
      expect(key.length).toBeGreaterThanOrEqual(MIN_ROOT_KEY_LENGTH);
    });
  });

  describe('generateScopedKey()', () => {
    test('should generate read keys starting with "r_"', () => {
      const key = generateScopedKey('read');
      expect(key.startsWith('r_')).toBe(true);
    });

    test('should generate append keys starting with "a_"', () => {
      const key = generateScopedKey('append');
      expect(key.startsWith('a_')).toBe(true);
    });

    test('should generate write keys starting with "w_"', () => {
      const key = generateScopedKey('write');
      expect(key.startsWith('w_')).toBe(true);
    });

    test('should have total length of 22+ characters', () => {
      const key = generateScopedKey('read');
      expect(key.length).toBeGreaterThanOrEqual(MIN_ROOT_KEY_LENGTH);
    });

    test('should have base62 suffix after prefix', () => {
      const key = generateScopedKey('append');
      const suffix = key.substring(2); // Remove 'a_' prefix
      expect(suffix).toMatch(BASE62_REGEX);
      expect(suffix.length).toBeGreaterThanOrEqual(MIN_SCOPED_SUFFIX_LENGTH);
    });

    test('should match scoped key pattern', () => {
      const readKey = generateScopedKey('read');
      const appendKey = generateScopedKey('append');
      const writeKey = generateScopedKey('write');

      expect(readKey).toMatch(/^r_[A-Za-z0-9]{20,}$/);
      expect(appendKey).toMatch(/^a_[A-Za-z0-9]{20,}$/);
      expect(writeKey).toMatch(/^w_[A-Za-z0-9]{20,}$/);
    });

    test('should throw for invalid permission type', () => {
      // @ts-expect-error - testing invalid input
      expect(() => generateScopedKey('invalid')).toThrow();
    });
  });

  describe('generateApiKey()', () => {
    test('should generate live keys with "sk_live_" prefix', () => {
      const key = generateApiKey('live');
      expect(key.startsWith('sk_live_')).toBe(true);
    });

    test('should generate test keys with "sk_test_" prefix', () => {
      const key = generateApiKey('test');
      expect(key.startsWith('sk_test_')).toBe(true);
    });

    test('should have base62 suffix of 20+ characters after prefix', () => {
      const liveKey = generateApiKey('live');
      const testKey = generateApiKey('test');

      const liveSuffix = liveKey.substring(8); // Remove 'sk_live_'
      const testSuffix = testKey.substring(8); // Remove 'sk_test_'

      expect(liveSuffix).toMatch(BASE62_REGEX);
      expect(testSuffix).toMatch(BASE62_REGEX);
      expect(liveSuffix.length).toBeGreaterThanOrEqual(MIN_API_SUFFIX_LENGTH);
      expect(testSuffix.length).toBeGreaterThanOrEqual(MIN_API_SUFFIX_LENGTH);
    });

    test('should match API key pattern', () => {
      const liveKey = generateApiKey('live');
      const testKey = generateApiKey('test');

      expect(liveKey).toMatch(/^sk_live_[A-Za-z0-9]{20,}$/);
      expect(testKey).toMatch(/^sk_test_[A-Za-z0-9]{20,}$/);
    });

    test('should throw for invalid mode', () => {
      // @ts-expect-error - testing invalid input
      expect(() => generateApiKey('invalid')).toThrow();
    });
  });

  describe('validateKey()', () => {
    describe('root key validation', () => {
      test('should accept valid root key', () => {
        const validKey = 'x8k2mP9qL3nR7mQ2pN4xK9';
        expect(validateKey(validKey, 'root')).toBe(true);
      });

      test('should accept longer root keys', () => {
        const longKey = 'x8k2mP9qL3nR7mQ2pN4xK9wL5zA3bC7';
        expect(validateKey(longKey, 'root')).toBe(true);
      });

      test('should reject root key that is too short', () => {
        const shortKey = 'x8k2mP9qL3nR7mQ2pN';
        expect(validateKey(shortKey, 'root')).toBe(false);
      });

      test('should reject root key with invalid characters', () => {
        const invalidKey = 'x8k2mP9qL3nR7mQ2pN4x!@';
        expect(validateKey(invalidKey, 'root')).toBe(false);
      });

      test('should reject root key with underscores', () => {
        const keyWithUnderscore = 'x8k2mP9qL3nR7mQ2pN4x_9';
        expect(validateKey(keyWithUnderscore, 'root')).toBe(false);
      });
    });

    describe('scoped key validation', () => {
      test('should accept valid read scoped key', () => {
        const validKey = 'r_x8k2mP9qL3nR7mQ2pN4x';
        expect(validateKey(validKey, 'scoped')).toBe(true);
      });

      test('should accept valid append scoped key', () => {
        const validKey = 'a_x8k2mP9qL3nR7mQ2pN4x';
        expect(validateKey(validKey, 'scoped')).toBe(true);
      });

      test('should accept valid write scoped key', () => {
        const validKey = 'w_x8k2mP9qL3nR7mQ2pN4x';
        expect(validateKey(validKey, 'scoped')).toBe(true);
      });

      test('should reject scoped key with invalid prefix', () => {
        const invalidKey = 'x_8k2mP9qL3nR7mQ2pN4x';
        expect(validateKey(invalidKey, 'scoped')).toBe(false);
      });

      test('should reject scoped key that is too short', () => {
        const shortKey = 'r_x8k2mP9qL3nR7mQ2';
        expect(validateKey(shortKey, 'scoped')).toBe(false);
      });

      test('should reject scoped key with invalid suffix characters', () => {
        const invalidKey = 'a_x8k2mP9qL3nR7mQ2!@#';
        expect(validateKey(invalidKey, 'scoped')).toBe(false);
      });
    });

    describe('API key validation', () => {
      test('should accept valid live API key', () => {
        const validKey = 'sk_live_x8k2mP9qL3nR7mQ2pN4x';
        expect(validateKey(validKey, 'api')).toBe(true);
      });

      test('should accept valid test API key', () => {
        const validKey = 'sk_test_x8k2mP9qL3nR7mQ2pN4x';
        expect(validateKey(validKey, 'api')).toBe(true);
      });

      test('should reject API key with invalid prefix', () => {
        const invalidKey = 'sk_prod_x8k2mP9qL3nR7mQ2pN4x';
        expect(validateKey(invalidKey, 'api')).toBe(false);
      });

      test('should reject API key that is too short', () => {
        const shortKey = 'sk_live_x8k2mP9qL3nR';
        expect(validateKey(shortKey, 'api')).toBe(false);
      });

      test('should reject API key with invalid suffix characters', () => {
        const invalidKey = 'sk_test_x8k2mP9qL3nR7mQ2!@#';
        expect(validateKey(invalidKey, 'api')).toBe(false);
      });
    });

    test('should reject empty string', () => {
      expect(validateKey('', 'root')).toBe(false);
      expect(validateKey('', 'scoped')).toBe(false);
      expect(validateKey('', 'api')).toBe(false);
    });

    test('should throw for invalid key type', () => {
      // @ts-expect-error - testing invalid input
      expect(() => validateKey('somekey', 'invalid')).toThrow();
    });
  });

  describe('secureCompare()', () => {
    test('should return true for identical strings', () => {
      const key = 'x8k2mP9qL3nR7mQ2pN4xK9';
      expect(secureCompare(key, key)).toBe(true);
    });

    test('should return false for different strings', () => {
      const key1 = 'x8k2mP9qL3nR7mQ2pN4xK9';
      const key2 = 'y9m3nP0rL4oS8nR3qM5yL0';
      expect(secureCompare(key1, key2)).toBe(false);
    });

    test('should return false for strings with same length but different content', () => {
      const key1 = 'x8k2mP9qL3nR7mQ2pN4xK9';
      const key2 = 'x8k2mP9qL3nR7mQ2pN4xK8'; // Last char different
      expect(secureCompare(key1, key2)).toBe(false);
    });

    test('should return false for strings with different lengths', () => {
      const key1 = 'x8k2mP9qL3nR7mQ2pN4xK9';
      const key2 = 'x8k2mP9qL3nR7mQ2pN4xK9extra';
      expect(secureCompare(key1, key2)).toBe(false);
    });

    test('should handle empty strings', () => {
      expect(secureCompare('', '')).toBe(true);
      expect(secureCompare('', 'nonempty')).toBe(false);
      expect(secureCompare('nonempty', '')).toBe(false);
    });

    test('should take similar time for near-matches and complete mismatches (timing test)', () => {
      const baseKey = 'x8k2mP9qL3nR7mQ2pN4xK9';
      const nearMatch = 'x8k2mP9qL3nR7mQ2pN4xK8'; // Only last char different
      const completeMismatch = 'ZZZZZZZZZZZZZZZZZZZZZ9'; // Completely different

      // Run comparison many times to measure timing
      const iterations = 10000;

      const startNear = performance.now();
      for (let i = 0; i < iterations; i++) {
        secureCompare(baseKey, nearMatch);
      }
      const timeNear = performance.now() - startNear;

      const startMismatch = performance.now();
      for (let i = 0; i < iterations; i++) {
        secureCompare(baseKey, completeMismatch);
      }
      const timeMismatch = performance.now() - startMismatch;

      // Times should be within reasonable range for constant-time behavior
      // This is a rough heuristic; exact timing can vary significantly in CI environments
      const ratio = Math.max(timeNear, timeMismatch) / Math.min(timeNear, timeMismatch);
      expect(ratio).toBeLessThan(3.0); // Allow 200% variance for CI system noise
    });
  });

  describe('hashKey()', () => {
    test('should produce consistent hash for same input', () => {
      const key = 'x8k2mP9qL3nR7mQ2pN4xK9';
      const hash1 = hashKey(key);
      const hash2 = hashKey(key);
      expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different inputs', () => {
      const key1 = 'x8k2mP9qL3nR7mQ2pN4xK9';
      const key2 = 'y9m3nP0rL4oS8nR3qM5yL0';
      const hash1 = hashKey(key1);
      const hash2 = hashKey(key2);
      expect(hash1).not.toBe(hash2);
    });

    test('should produce hash of appropriate length', () => {
      const key = 'x8k2mP9qL3nR7mQ2pN4xK9';
      const hash = hashKey(key);
      // SHA-256 produces 64 hex characters
      expect(hash.length).toBe(64);
    });

    test('should produce hex string', () => {
      const key = 'x8k2mP9qL3nR7mQ2pN4xK9';
      const hash = hashKey(key);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should handle empty string', () => {
      const hash = hashKey('');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should handle unicode characters', () => {
      const hash = hashKey('key-with-émojis-🔑');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should be irreversible (hash differs significantly from input)', () => {
      const key = 'x8k2mP9qL3nR7mQ2pN4xK9';
      const hash = hashKey(key);
      // Hash should not contain the original key
      expect(hash).not.toContain(key);
      // Hash should look nothing like the input (no base62, just hex)
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('Exported Constants', () => {
    test('should export BASE62_ALPHABET with 62 characters', () => {
      expect(BASE62_ALPHABET).toBeDefined();
      expect(BASE62_ALPHABET.length).toBe(62);
      expect(BASE62_ALPHABET).toMatch(/^[A-Za-z0-9]+$/);
    });

    test('should export KEY_PATTERNS object', () => {
      expect(KEY_PATTERNS).toBeDefined();
      expect(KEY_PATTERNS.rootCapability).toBeInstanceOf(RegExp);
      expect(KEY_PATTERNS.scopedKey).toBeInstanceOf(RegExp);
      expect(KEY_PATTERNS.apiKey).toBeInstanceOf(RegExp);
    });
  });
});


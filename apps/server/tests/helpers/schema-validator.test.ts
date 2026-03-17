/**
 * Tests for OpenAPI Schema Validator
 */

import { describe, test, expect } from 'bun:test';
import {
  validateResponse,
  assertValidResponse,
  getSchema,
  getSchemaNames,
} from './schema-validator';

describe('Schema Validator', () => {
  describe('getSchemaNames', () => {
    test('returns array of schema names', () => {
      const names = getSchemaNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(100); // We have 335+ schemas
    });

    test('includes common response schemas', () => {
      const names = getSchemaNames();
      expect(names).toContain('BootstrapResponse');
      expect(names).toContain('AppendResponse');
      expect(names).toContain('FileReadResponse');
      expect(names).toContain('Error');
    });

    test('returns sorted names', () => {
      const names = getSchemaNames();
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });
  });

  describe('getSchema', () => {
    test('returns schema for valid name', () => {
      const schema = getSchema('BootstrapResponse');
      expect(schema).toBeDefined();
      expect(typeof schema?.parse).toBe('function');
    });

    test('returns undefined for invalid name', () => {
      const schema = getSchema('NonExistentSchema');
      expect(schema).toBeUndefined();
    });
  });

  describe('validateResponse', () => {
    test('returns success for valid BootstrapResponse', () => {
      const testKey = 'key123456789012345678901234567890';
      const validData = {
        ok: true,
        data: {
          workspaceId: 'ws_ABC123DEF456',
          // New required fields
          keys: {
            read: testKey,
            append: testKey,
            write: testKey,
          },
          urls: {
            api: {
              read: `http://localhost/r/${testKey}`,
              append: `http://localhost/a/${testKey}`,
              write: `http://localhost/w/${testKey}`,
            },
            web: {
              read: `http://localhost/r/${testKey}`,
              append: `http://localhost/a/${testKey}`,
              write: `http://localhost/w/${testKey}`,
              claim: `http://localhost/claim/${testKey}`,
            },
          },
          // Deprecated but still returned for backward compatibility
          rootFolder: {
            path: '/',
            urls: {
              read: `http://localhost/r/${testKey}/folders`,
              append: `http://localhost/a/${testKey}/folders`,
              write: `http://localhost/w/${testKey}/folders`,
            },
          },
          webUrl: 'http://localhost/control/ws_ABC123DEF456',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      };

      const result = validateResponse(validData, 'BootstrapResponse');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
      }
    });

    test('returns failure for invalid BootstrapResponse', () => {
      const invalidData = {
        ok: true,
        data: {
          // Missing required fields
        },
      };

      const result = validateResponse(invalidData, 'BootstrapResponse');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.message).toContain('does not match schema');
      }
    });

    test('throws for unknown schema name', () => {
      expect(() => {
        validateResponse({}, 'UnknownSchema');
      }).toThrow('Unknown schema: "UnknownSchema"');
    });

    test('validates Error schema', () => {
      const validError = {
        ok: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found',
        },
      };

      const result = validateResponse(validError, 'Error');
      expect(result.success).toBe(true);
    });

    test('provides detailed error message on failure', () => {
      const invalidData = {
        ok: true,
        data: {
          workspaceId: 'invalid', // Should match ws_ pattern
        },
      };

      const result = validateResponse(invalidData, 'BootstrapResponse');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('BootstrapResponse');
        expect(result.message).toContain('Received:');
      }
    });
  });

  describe('assertValidResponse', () => {
    test('does not throw for valid data', () => {
      const validError = {
        ok: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found',
        },
      };

      expect(() => {
        assertValidResponse(validError, 'Error');
      }).not.toThrow();
    });

    test('throws for invalid data', () => {
      expect(() => {
        assertValidResponse({ invalid: true }, 'Error');
      }).toThrow(/does not match schema "Error"/);
    });
  });
});


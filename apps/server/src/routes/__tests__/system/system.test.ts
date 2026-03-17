import { describe, test, expect } from 'bun:test';
import { app } from '../../../index';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

describe('System Endpoints', () => {
  describe('GET /api/v1/changelog', () => {
    test('should return 200', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/changelog')
      );
      expect(response.status).toBe(200);
    });

    test('should return ok: true', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/changelog')
      );
      const json = await response.json();
      expect(json.ok).toBe(true);
      assertValidResponse(json, 'GetChangelogResponse');
    });

    test('should return currentVersion as string', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/changelog')
      );
      const json = await response.json();
      expect(typeof json.data.currentVersion).toBe('string');
      expect(json.data.currentVersion.length).toBeGreaterThan(0);
    });

    test('should return releasedAt as ISO datetime string', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/changelog')
      );
      const json = await response.json();
      expect(typeof json.data.releasedAt).toBe('string');
      // Validate ISO datetime format (with or without milliseconds)
      const date = new Date(json.data.releasedAt);
      expect(date.getTime()).not.toBeNaN();
      // Verify it parses to a valid date that round-trips correctly
      expect(json.data.releasedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    });

    test('should return entries array', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/changelog')
      );
      const json = await response.json();
      expect(Array.isArray(json.data.entries)).toBe(true);
      expect(json.data.entries.length).toBeGreaterThan(0);
    });

    test('should have version, date, changes in each entry', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/changelog')
      );
      const json = await response.json();

      for (const entry of json.data.entries) {
        expect(typeof entry.version).toBe('string');
        expect(typeof entry.date).toBe('string');
        // Validate date format (YYYY-MM-DD)
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Array.isArray(entry.changes)).toBe(true);
      }
    });

    test('should have type and description in each change', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/changelog')
      );
      const json = await response.json();

      const validTypes = ['added', 'changed', 'deprecated', 'removed', 'fixed', 'security'];

      for (const entry of json.data.entries) {
        for (const change of entry.changes) {
          expect(typeof change.type).toBe('string');
          expect(validTypes).toContain(change.type);
          expect(typeof change.description).toBe('string');
          expect(change.description.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

describe('OpenAPI Endpoints', () => {
  describe('GET /openapi.json', () => {
    test('should return 200', async () => {
      const response = await app.handle(
        new Request('http://localhost/openapi.json')
      );
      expect(response.status).toBe(200);
    });

    test('should return valid JSON', async () => {
      const response = await app.handle(
        new Request('http://localhost/openapi.json')
      );
      const json = await response.json();
      expect(typeof json).toBe('object');
    });

    test('should have openapi version field', async () => {
      const response = await app.handle(
        new Request('http://localhost/openapi.json')
      );
      const json = await response.json();
      expect(json.openapi).toBeDefined();
      expect(typeof json.openapi).toBe('string');
      expect(json.openapi).toMatch(/^3\.\d+\.\d+$/);
    });

    test('should have info field', async () => {
      const response = await app.handle(
        new Request('http://localhost/openapi.json')
      );
      const json = await response.json();
      expect(json.info).toBeDefined();
      expect(typeof json.info).toBe('object');
      expect(json.info.title).toBeDefined();
      expect(json.info.version).toBeDefined();
    });

    test('should have paths field', async () => {
      const response = await app.handle(
        new Request('http://localhost/openapi.json')
      );
      const json = await response.json();
      expect(json.paths).toBeDefined();
      expect(typeof json.paths).toBe('object');
    });
  });

  describe('GET /docs', () => {
    test('should return 200', async () => {
      const response = await app.handle(
        new Request('http://localhost/docs')
      );
      expect(response.status).toBe(200);
    });

    test('should return HTML', async () => {
      const response = await app.handle(
        new Request('http://localhost/docs')
      );
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('text/html');
    });

    test('should include swagger-ui script', async () => {
      const response = await app.handle(
        new Request('http://localhost/docs')
      );
      const html = await response.text();
      expect(html).toContain('swagger-ui');
      expect(html).toContain('/openapi.json');
    });
  });
});


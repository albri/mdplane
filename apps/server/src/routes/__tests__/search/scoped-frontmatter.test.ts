import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createSearchTestApp,
  resetTestSearch,
  assertValidResponse,
  sqlite,
  VALID_READ_KEY,
  VALID_FOLDER_READ_KEY,
  VALID_FILE_READ_KEY,
  VALID_API_KEY,
  type TestApp,
} from './test-setup';

describe('Scoped Search and Frontmatter Query', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createSearchTestApp();
  });

  beforeEach(() => {
    resetTestSearch();
  });

  describe('GET /r/:readKey/search - Scoped Search', () => {
    describe('File Content Search', () => {
      test('should return file results when query matches markdown content within scope', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/search?q=Gamma%20Project`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'SearchResponse');

        const fileHits = (body.data.results as Array<{ type: string; file?: { path: string } }>).filter(
          (r) => r.type === 'file'
        );
        expect(fileHits.length).toBeGreaterThan(0);
        expect(fileHits.some((r) => r.file?.path === '/projects/gamma/readme.md')).toBe(true);
      });

      test('should exclude deleted files from scoped search results', async () => {
        sqlite.exec("UPDATE files SET deleted_at = '2026-01-01T00:00:00Z' WHERE id = 'file_3'");

        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/search?q=Gamma%20Project`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'SearchResponse');

        const hasGamma = (body.data.results as Array<{ file?: { path: string } }>).some(
          (r) => r.file?.path === '/projects/gamma/readme.md'
        );
        expect(hasGamma).toBe(false);
      });
    });

    describe('File Scope', () => {
      test('should search within file scope for file read key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_FILE_READ_KEY}/search?q=test`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.results).toBeDefined();
      });

      test('should only return appends from scoped file', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_FILE_READ_KEY}/search?type=task`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const files = body.data.results.map((r: { file: { id: string; path: string } }) => r.file.path);
        const uniqueFiles = [...new Set(files)];
        expect(uniqueFiles.length).toBeLessThanOrEqual(1);
      });
    });

    describe('Folder Scope', () => {
      test('should search within folder scope for folder read key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_FOLDER_READ_KEY}/search?q=test`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.results).toBeDefined();
      });

      test('should return results from all files in folder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_FOLDER_READ_KEY}/search`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.results).toBeDefined();
      });
    });

    describe('Filter Support', () => {
      test('should support same filters as workspace search', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_FOLDER_READ_KEY}/search?type=task&status=pending`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { type: string; status?: string }) => {
          expect(result.type).toBe('task');
          if (result.status) {
            expect(result.status).toBe('pending');
          }
        });
      });
    });
  });

  describe('Frontmatter Query', () => {
    describe('Basic Frontmatter Filtering', () => {
      test('should filter by frontmatter fields (?frontmatter.status=active)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?frontmatter.status=active`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { frontmatter?: { status?: string } }) => {
          if (result.frontmatter?.status) {
            expect(result.frontmatter.status).toBe('active');
          }
        });
      });

      test('should match array fields (?frontmatter.skills=security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?frontmatter.skills=security`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { frontmatter?: { skills?: string[] } }) => {
          if (result.frontmatter?.skills) {
            expect(result.frontmatter.skills).toContain('security');
          }
        });
      });

      test('should support OR matching with comma (?frontmatter.skills=security,audit)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?frontmatter.skills=security,audit`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { frontmatter?: { skills?: string[] } }) => {
          if (result.frontmatter?.skills) {
            const hasMatch = result.frontmatter.skills.some((s: string) =>
              ['security', 'audit'].includes(s)
            );
            expect(hasMatch).toBe(true);
          }
        });
      });
    });

    describe('Indexed vs Custom Fields', () => {
      test('should handle indexed fields (status, skills, tags, author, priority)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?frontmatter.priority=high`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should handle custom fields (slower, full scan)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?frontmatter.customField=value`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });

    describe('Frontmatter Response', () => {
      test('should return frontmatter in file-type results', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?frontmatter.status=active`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        const body = await response.json();
        const fileResults = body.data.results.filter((r: { type?: string }) => r.type === 'file');
        for (const result of fileResults) {
          expect(result.frontmatter).toBeDefined();
        }
      });
    });
  });
});


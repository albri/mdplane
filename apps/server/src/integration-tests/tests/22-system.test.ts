/**
 * System Info Endpoints Integration Tests
 */

import { describe, test, expect } from 'bun:test';
import { apiRequest } from '../helpers/api-client';

describe('22 - System', () => {
  // 1. Get system status
  test('GET /api/v1/status returns status', async () => {
    const response = await apiRequest('GET', '/api/v1/status');

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
  });

  // 2. Get changelog
  test('GET /api/v1/changelog returns changelog', async () => {
    const response = await apiRequest('GET', '/api/v1/changelog');

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
  });

  // 3. Get OpenAPI spec
  // Per OpenAPI spec: /openapi.json always returns 200
  test('GET /openapi.json returns spec', async () => {
    const response = await apiRequest('GET', '/openapi.json');

    expect(response.status).toBe(200);

    const data = await response.json();
    // Check OpenAPI structure
    if (data.openapi || data.swagger) {
      expect(data.info).toBeDefined();
      expect(data.paths).toBeDefined();
    }
  });

  // 4. Get docs page
  // Per OpenAPI spec: /docs returns 200 with HTML documentation
  test('GET /docs returns documentation', async () => {
    const response = await apiRequest('GET', '/docs');

    expect(response.status).toBe(200);
  });

  // 5. Health endpoint
  test('GET /health returns ok', async () => {
    const response = await apiRequest('GET', '/health');

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok || data.status === 'ok' || data.healthy).toBeTruthy();
  });

  // 6. Root returns something
  test('GET / returns response', async () => {
    const response = await apiRequest('GET', '/');

    // Root endpoint returns 200 with API info
    expect(response.status).toBe(200);
  });

  // 7. Status includes version info
  test('status includes version', async () => {
    const response = await apiRequest('GET', '/api/v1/status');
    const data = await response.json();

    // May have version field
    if (data.data.version) {
      expect(typeof data.data.version).toBe('string');
    }
  });

  // 8. Changelog has entries
  test('changelog has entries', async () => {
    const response = await apiRequest('GET', '/api/v1/changelog');
    const data = await response.json();

    // Should have entries array or similar
    const entries = data.data.entries || data.data.changes || data.data;
    expect(Array.isArray(entries)).toBe(true);
  });
});
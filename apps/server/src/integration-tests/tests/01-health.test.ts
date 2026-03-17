/**
 * Health Check Tests
 *
 * Verify backend services are operational.
 */

import { describe, test, expect } from 'bun:test';
import { apiRequest } from '../helpers/api-client';

describe('01 - Health Check', () => {
  test('returns healthy status', async () => {
    const response = await apiRequest('GET', '/health');
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe('healthy');
  });

  test('returns version', async () => {
    const response = await apiRequest('GET', '/health');
    const data = await response.json();

    expect(data.version).toBeDefined();
    expect(typeof data.version).toBe('string');
    expect(data.version.length).toBeGreaterThan(0);
  });

  test('returns uptimeSeconds', async () => {
    const response = await apiRequest('GET', '/health');
    const data = await response.json();

    expect(data.uptimeSeconds).toBeDefined();
    expect(typeof data.uptimeSeconds).toBe('number');
    expect(data.uptimeSeconds).toBeGreaterThan(0);
  });
});

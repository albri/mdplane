/**
 * Connectivity Test
 *
 * Fail-fast gate - if API is unreachable, all other tests are skipped.
 * This test runs FIRST due to the 00- prefix.
 */

import { describe, test, expect } from 'bun:test';
import { CONFIG } from '../config';
import { apiRequest } from '../helpers/api-client';

describe('00 - Connectivity', () => {
  test('API is reachable', async () => {
    const response = await apiRequest('GET', '/health', {
      timeout: CONFIG.TIMEOUTS.CONNECTIVITY,
    });

    expect(response.ok).toBe(true);
  });

  test('API returns valid JSON', async () => {
    const response = await apiRequest('GET', '/health');
    const data = await response.json();

    expect(data).toBeDefined();
    expect(typeof data).toBe('object');
  });
});

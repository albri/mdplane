/**
 * Integration Test Infrastructure
 *
 * Tests to verify the integration test environment is correctly configured.
 */

import { test, describe } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkConnectivity } from '../helpers/api-client';
import { CONFIG } from '../config';

describe('00 - Integration Test Infrastructure', () => {
  test('should connect to localhost:3001', async () => {
    await checkConnectivity();
  });

  test('should use file-backed database for production parity', async () => {
    const dbPath = resolve(CONFIG.TEST_DB_PATH);
    
    // Verify DATABASE_URL is not forcing in-memory database
    if (process.env.DATABASE_URL === ':memory:') {
      throw new Error('DATABASE_URL is set to :memory:, integration tests should use file-backed database');
    }
    
    // Verify the database file exists (server should have created it during setup)
    const dbExists = existsSync(dbPath);
    if (!dbExists) {
      throw new Error(`Integration test database file does not exist: ${dbPath}`);
    }
  });
});

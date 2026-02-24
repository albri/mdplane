import { Elysia } from 'elysia';
import { keysRoute } from '../../keys';
import { appendsRoute } from '../../appends';
import {
  resetKeysTestData,
  TEST_ADMIN_KEY,
  TEST_APPEND_KEY,
  TEST_READ_KEY,
  TEST_OTHER_ADMIN_KEY,
} from '../fixtures/keys-fixtures';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

// Re-export fixtures and helpers
export { resetKeysTestData, assertValidResponse };

// Test app type
export type TestApp = { handle: (request: Request) => Response | Promise<Response> };

// Constants for testing
export const VALID_ADMIN_KEY = TEST_ADMIN_KEY;
export const VALID_APPEND_KEY = TEST_APPEND_KEY;
export const VALID_READ_KEY = TEST_READ_KEY;
export const VALID_OTHER_ADMIN_KEY = TEST_OTHER_ADMIN_KEY;
export const INVALID_KEY = 'short';

// Key format patterns from specification
export const SCOPED_READ_KEY_PATTERN = /^r_[A-Za-z0-9]{20,}$/;
export const SCOPED_APPEND_KEY_PATTERN = /^a_[A-Za-z0-9]{20,}$/;
export const SCOPED_WRITE_KEY_PATTERN = /^w_[A-Za-z0-9]{20,}$/;
export const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
export const KEY_ID_PATTERN = /^key_[A-Za-z0-9]+$/;

// Expired key from fixtures for testing
export const EXPIRED_SCOPED_KEY = 'a_keyExpired0P9qL3nR7mQ';

/**
 * Create test app with keys and appends routes
 */
export function createTestApp(): TestApp {
  return new Elysia().use(keysRoute).use(appendsRoute);
}


import { Elysia } from 'elysia';
import { searchRoute } from '../../../routes/search';
import {
  resetTestSearch,
  TEST_API_KEY,
  TEST_EXPIRED_API_KEY,
  TEST_REVOKED_API_KEY,
  TEST_EXPIRED_KEY,
  TEST_FILE_READ_KEY,
  TEST_FOLDER_READ_KEY,
  TEST_READ_KEY,
  TEST_REVOKED_KEY,
} from '../fixtures/search-fixtures';

import { sqlite } from '../../../db';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

export { resetTestSearch, sqlite, assertValidResponse };

export const VALID_READ_KEY = TEST_READ_KEY;
export const VALID_FOLDER_READ_KEY = TEST_FOLDER_READ_KEY;
export const VALID_FILE_READ_KEY = TEST_FILE_READ_KEY;
export const VALID_API_KEY = TEST_API_KEY;
export const EXPIRED_API_KEY = TEST_EXPIRED_API_KEY;
export const REVOKED_API_KEY = TEST_REVOKED_API_KEY;
export const EXPIRED_KEY = TEST_EXPIRED_KEY;
export const REVOKED_KEY = TEST_REVOKED_KEY;
export const INVALID_KEY = 'short';
export const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export function createSearchTestApp() {
  return new Elysia().use(searchRoute);
}

export type TestApp = ReturnType<typeof createSearchTestApp>;


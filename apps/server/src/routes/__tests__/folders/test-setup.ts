import { Elysia } from 'elysia';
import { foldersRoute } from '../../../routes/folders';
import {
  TEST_READ_KEY,
  TEST_WRITE_KEY,
  TEST_APPEND_KEY,
  TEST_EXPIRED_KEY,
  TEST_REVOKED_KEY,
  resetTestFolders,
} from '../../../../tests/helpers/folder-fixtures';
import { hashKey } from '../../../core/capability-keys';
import { sqlite } from '../../../db';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

export { assertValidResponse };
export { hashKey, sqlite };
export { resetTestFolders };

export const VALID_READ_KEY = TEST_READ_KEY;
export const VALID_WRITE_KEY = TEST_WRITE_KEY;
export const VALID_APPEND_KEY = TEST_APPEND_KEY;
export const EXPIRED_KEY = TEST_EXPIRED_KEY;
export const REVOKED_KEY = TEST_REVOKED_KEY;
export const INVALID_KEY = 'short';
export const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export type TestApp = { handle: (request: Request) => Response | Promise<Response> };

export function createFoldersTestApp(): TestApp {
  return new Elysia().use(foldersRoute);
}


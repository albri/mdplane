/**
 * Integration Tests Configuration
 *
 * Central configuration for local integration tests.
 */

import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

// apps/server/src/integration-tests -> apps/server
const serverRoot = resolve(import.meta.dir, '../..');
const defaultDbPath = resolve(
  tmpdir(),
  `mdplane-integration-${process.pid}-${Date.now()}.sqlite`
);

const dbUrl = process.env.DATABASE_URL ?? defaultDbPath;

export const CONFIG = {
  /** Local test API URL */
  TEST_API_URL: process.env.TEST_API_URL ?? 'http://127.0.0.1:3001',

  /** Local test database URL (canonical setting, file-backed SQLite) */
  TEST_DB_URL: dbUrl,

  /** Local test database path (derived from TEST_DB_URL for file operations) */
  TEST_DB_PATH: dbUrl.replace(/^file:/, ''),

  /** Prefix for all test data (for isolation and cleanup) */
  TEST_PREFIX: '__int_',

  /** Timeouts in milliseconds */
  TIMEOUTS: {
    /** Connectivity check timeout */
    CONNECTIVITY: 5_000,
    /** Standard API request timeout */
    REQUEST: 10_000,
    /** Claim expiry wait (claims expire after 60s by default) */
    CLAIM_EXPIRY: 65_000,
    /** Server startup wait */
    SERVER_STARTUP: 15_000,
    /** WebSocket connection timeout */
    WEBSOCKET: 10_000,
    /** Webhook delivery wait */
    WEBHOOK_DELIVERY: 15_000,
  },
} as const;

// API constants
export const API_VERSION = 'v1';

// Global limits and timing constants.
export const LIMITS = {
  APPEND_MAX_SIZE_BYTES: 1_048_576,
  FILE_MAX_SIZE_BYTES: 10_485_760,
  MAX_APPENDS_PER_FILE: 10_000,
  PATH_MAX_LENGTH: 1024,
  FILENAME_MAX_LENGTH: 255,
  FOLDER_DEPTH_MAX: 10,
  QUERY_MAX_LENGTH: 500,
  AUTHOR_MAX_LENGTH: 64,
  LIST_LIMIT_DEFAULT: 50,
  LIST_LIMIT_MAX: 1000,
  APPENDS_LIMIT_MAX: 1000,
  RATE_LIMIT_READ: 300,
  RATE_LIMIT_APPEND: 60,
  RATE_LIMIT_WRITE: 30,
  RATE_LIMIT_BOOTSTRAP: 10,
  CLAIM_DEFAULT_DURATION_MS: 300_000,
  CLAIM_MAX_DURATION_MS: 3_600_000,
  HEARTBEAT_INTERVAL_MS: 60_000,
  WEBHOOK_MAX_PER_FILE: 10,
  WEBHOOK_MAX_PER_FOLDER: 10,
  WEBHOOK_RETRY_MAX: 5,
} as const;

// Compatibility exports.
export const DEFAULT_RATE_LIMIT = LIMITS.RATE_LIMIT_READ;
export const MAX_FILE_SIZE = LIMITS.FILE_MAX_SIZE_BYTES;
export const MAX_APPEND_SIZE = LIMITS.APPEND_MAX_SIZE_BYTES;
export const MAX_APPENDS_PER_FILE = LIMITS.MAX_APPENDS_PER_FILE;

// Retention.
export const DELETED_FILE_RETENTION_DAYS = 7;
export const EXPORT_LINK_EXPIRY_HOURS = 24;

// Key patterns.
export const KEY_PATTERNS = {
  rootCapability: /^[A-Za-z0-9]{22,}$/,
  scopedKey: /^(r|a|w)_[A-Za-z0-9]{20,}$/,
  apiKey: /^sk_(live|test)_[A-Za-z0-9]{20,}$/,
} as const;

// URL constants.
export { URLS, DEV_URLS, getApiUrl, isDevelopment } from './urls';

// Branding constants.
export {
  APP_NAME,
  ASCII_WORDMARK,
  HERO_DESCRIPTION,
  TAGLINE,
} from './branding';

// Demo workspace constants.
export { DEMO_WORKSPACE_ID, DEMO_READ_KEY, DEMO_WORKSPACE_NAME } from './demo';

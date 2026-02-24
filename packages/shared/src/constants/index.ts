// API constants
export const API_VERSION = 'v1';

/**
 * Global limits for mdplane API.
 * All limits are enforced server-side and documented in OpenAPI spec.
 */
export const LIMITS = {
  // Content limits
  /** Maximum size for a single append operation (1 MB) */
  APPEND_MAX_SIZE_BYTES: 1_048_576,
  /** Maximum total file size (10 MB) */
  FILE_MAX_SIZE_BYTES: 10_485_760,
  /** Maximum number of appends per file */
  MAX_APPENDS_PER_FILE: 10_000,

  // Path limits
  /** Maximum total path length including folder and filename */
  PATH_MAX_LENGTH: 1024,
  /** Maximum filename length (excluding folder path) */
  FILENAME_MAX_LENGTH: 255,
  /** Maximum folder nesting depth */
  FOLDER_DEPTH_MAX: 10,

  // Query limits
  /** Maximum search query length */
  QUERY_MAX_LENGTH: 500,
  /** Maximum author field length */
  AUTHOR_MAX_LENGTH: 64,

  // Pagination limits
  /** Default number of items per page */
  LIST_LIMIT_DEFAULT: 50,
  /** Maximum items per page for list operations */
  LIST_LIMIT_MAX: 1000,
  /** Maximum appends returned in a single request */
  APPENDS_LIMIT_MAX: 1000,

  // Rate limits (per minute per key)
  /** Read operations: 300 requests/minute */
  RATE_LIMIT_READ: 300,
  /** Append operations: 60 requests/minute */
  RATE_LIMIT_APPEND: 60,
  /** Write operations: 30 requests/minute */
  RATE_LIMIT_WRITE: 30,
  /** Bootstrap operations: 10 requests/minute */
  RATE_LIMIT_BOOTSTRAP: 10,

  // Timing
  /** Default claim duration (5 minutes) */
  CLAIM_DEFAULT_DURATION_MS: 300_000,
  /** Maximum claim duration (1 hour) */
  CLAIM_MAX_DURATION_MS: 3_600_000,
  /** Heartbeat interval for long-running claims (1 minute) */
  HEARTBEAT_INTERVAL_MS: 60_000,

  // Webhooks
  /** Maximum webhooks per file */
  WEBHOOK_MAX_PER_FILE: 10,
  /** Maximum webhooks per folder */
  WEBHOOK_MAX_PER_FOLDER: 10,
  /** Maximum webhook retry attempts */
  WEBHOOK_RETRY_MAX: 5,
} as const;

// Compatibility exports
export const DEFAULT_RATE_LIMIT = LIMITS.RATE_LIMIT_READ;
export const MAX_FILE_SIZE = LIMITS.FILE_MAX_SIZE_BYTES;
export const MAX_APPEND_SIZE = LIMITS.APPEND_MAX_SIZE_BYTES;
export const MAX_APPENDS_PER_FILE = LIMITS.MAX_APPENDS_PER_FILE;

// Retention
/** Soft-deleted files are recoverable for 7 days */
export const DELETED_FILE_RETENTION_DAYS = 7;
/** Export download links expire after 24 hours */
export const EXPORT_LINK_EXPIRY_HOURS = 24;

// Key patterns
export const KEY_PATTERNS = {
  rootCapability: /^[A-Za-z0-9]{22,}$/,
  scopedKey: /^(r|a|w)_[A-Za-z0-9]{20,}$/,
  apiKey: /^sk_(live|test)_[A-Za-z0-9]{20,}$/,
} as const;

// URL constants
export { URLS, DEV_URLS, getApiUrl, isDevelopment } from './urls';

// Branding constants
export {
  APP_NAME,
  ASCII_WORDMARK,
  BRAND_ACCENT_HEX,
  HERO_DESCRIPTION,
  splitWordmarkLines,
  TAGLINE,
  WORDMARK_MD_SPLIT_COL,
} from './branding';

// Demo workspace constants (read key only - append/write are server-side only)
export { DEMO_WORKSPACE_ID, DEMO_READ_KEY, DEMO_WORKSPACE_NAME } from './demo';

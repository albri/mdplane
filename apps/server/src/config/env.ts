import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type NodeEnv = 'development' | 'test' | 'production';

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_DATABASE_URL = './data/mdplane.sqlite';
const DEFAULT_BASE_URL = 'http://127.0.0.1:3001';
const DEFAULT_APP_URL = 'http://127.0.0.1:3000';
const DEFAULT_WS_URL = 'ws://127.0.0.1:3001/ws';
const DEFAULT_BETTER_AUTH_URL = 'http://localhost:3001';
const DEFAULT_MAX_WORKSPACE_STORAGE_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_VOLUME_SIZE_BYTES = 5 * 1024 * 1024 * 1024;

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'production' || value === 'test') {
    return value;
  }
  return 'development';
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseHeaderName(value: string | undefined, fallback: string): string {
  if (value == null || value.trim() === '') return fallback;
  const trimmed = value.trim().toLowerCase();
  const valid = /^[a-z0-9-]+$/u.test(trimmed);
  return valid ? trimmed : fallback;
}

function parseUrl(
  value: string | undefined,
  fallback: string,
  strict: boolean = false,
  key: string = 'URL'
): string {
  const candidate = value?.trim() ? value.trim() : fallback;
  try {
    return new URL(candidate).toString().replace(/\/$/, '');
  } catch {
    if (strict) {
      throw new Error(`${key} must be a valid absolute URL`);
    }
    return fallback;
  }
}

function readPackageVersionFallback(): string {
  const candidates = [
    resolve(process.cwd(), 'package.json'),
    resolve(process.cwd(), 'apps/server/package.json'),
    resolve(import.meta.dir, '../../package.json'),
    resolve(import.meta.dir, '../../../package.json'),
  ];

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as { version?: unknown };
      if (typeof parsed.version === 'string' && parsed.version.trim() !== '') {
        return parsed.version.trim();
      }
    } catch {
      // Ignore malformed files and continue searching fallback candidates.
    }
  }

  return '0.0.0';
}

function readRequiredUrl(
  source: NodeJS.ProcessEnv,
  key: string,
  isProduction: boolean,
  fallback: string
): string {
  const value = source[key];
  if (value == null || value.trim() === '') {
    if (isProduction) {
      throw new Error(`${key} must be set in production`);
    }
    return parseUrl(undefined, fallback);
  }
  return parseUrl(value, fallback, isProduction, key);
}

export interface ServerEnv {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  isTest: boolean;
  integrationTestMode: boolean;
  databaseReset: boolean;
  governedModeEnabled: boolean;
  hasOAuthProvidersConfigured: boolean;
  packageVersion: string;
  port: number;
  host: string;
  databaseUrl: string;
  baseUrl: string;
  appUrl: string;
  wsUrl: string;
  betterAuthUrl: string;
  betterAuthSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  adminSecret?: string;
  mpJwtSecret?: string;
  mpEnv?: string;
  disableBackgroundJobs: boolean;
  allowHttpWebhooks: boolean;
  trustProxyHeaders: boolean;
  trustSingleXForwardedFor: boolean;
  requireTrustedClientIpForAnonymousRateLimits: boolean;
  trustedProxySharedSecret?: string;
  trustedProxySharedSecretHeader: string;
  wsDebug: boolean;
  maxWorkspaceStorageBytes: number;
  maxFileSizeBytes: number;
  maxVolumeSizeBytes: number;
}

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const nodeEnv = parseNodeEnv(source.NODE_ENV ?? source.BUN_ENV);
  const integrationTestMode = parseBoolean(source.INTEGRATION_TEST_MODE, false);
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test' || integrationTestMode;

  const githubClientId = source.GITHUB_CLIENT_ID?.trim() || undefined;
  const githubClientSecret = source.GITHUB_CLIENT_SECRET?.trim() || undefined;
  const googleClientId = source.GOOGLE_CLIENT_ID?.trim() || undefined;
  const googleClientSecret = source.GOOGLE_CLIENT_SECRET?.trim() || undefined;

  const hasOAuthProvidersConfigured =
    (githubClientId != null && githubClientSecret != null)
    || (googleClientId != null && googleClientSecret != null);

  const governedModeEnabled = parseBoolean(source.MDPLANE_GOVERNED_MODE, true);
  const betterAuthSecret = source.BETTER_AUTH_SECRET?.trim() || undefined;
  const mpJwtSecret = source.MP_JWT_SECRET?.trim() || undefined;

  if (isProduction && betterAuthSecret == null) {
    throw new Error('BETTER_AUTH_SECRET must be set in production');
  }
  if (isProduction && mpJwtSecret == null) {
    throw new Error('MP_JWT_SECRET must be set in production');
  }

  return {
    nodeEnv,
    isProduction,
    isTest,
    integrationTestMode,
    databaseReset: parseBoolean(source.DATABASE_RESET, false),
    governedModeEnabled,
    hasOAuthProvidersConfigured,
    packageVersion: source.npm_package_version?.trim() || readPackageVersionFallback(),
    port: parsePositiveInt(source.PORT, DEFAULT_PORT),
    host: source.HOST?.trim() || DEFAULT_HOST,
    databaseUrl: source.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
    baseUrl: readRequiredUrl(source, 'BASE_URL', isProduction, DEFAULT_BASE_URL),
    appUrl: readRequiredUrl(source, 'APP_URL', isProduction, DEFAULT_APP_URL),
    wsUrl: readRequiredUrl(source, 'WS_URL', isProduction, DEFAULT_WS_URL),
    betterAuthUrl: readRequiredUrl(source, 'BETTER_AUTH_URL', isProduction, DEFAULT_BETTER_AUTH_URL),
    betterAuthSecret,
    githubClientId,
    githubClientSecret,
    googleClientId,
    googleClientSecret,
    adminSecret: source.ADMIN_SECRET?.trim() || undefined,
    mpJwtSecret,
    mpEnv: source.MP_ENV?.trim() || undefined,
    disableBackgroundJobs: parseBoolean(source.DISABLE_BACKGROUND_JOBS, false),
    allowHttpWebhooks: parseBoolean(source.ALLOW_HTTP_WEBHOOKS, false),
    trustProxyHeaders: parseBoolean(source.TRUST_PROXY_HEADERS, false),
    trustSingleXForwardedFor: parseBoolean(source.TRUST_SINGLE_X_FORWARDED_FOR, false),
    requireTrustedClientIpForAnonymousRateLimits: parseBoolean(
      source.REQUIRE_TRUSTED_CLIENT_IP_FOR_ANON_RATE_LIMITS,
      isProduction
    ),
    trustedProxySharedSecret: source.TRUSTED_PROXY_SHARED_SECRET?.trim() || undefined,
    trustedProxySharedSecretHeader: parseHeaderName(
      source.TRUSTED_PROXY_SHARED_SECRET_HEADER,
      'x-mdplane-proxy-secret'
    ),
    wsDebug: parseBoolean(source.MP_DEBUG_WS, false),
    maxWorkspaceStorageBytes: parsePositiveInt(
      source.MAX_WORKSPACE_STORAGE_BYTES,
      DEFAULT_MAX_WORKSPACE_STORAGE_BYTES
    ),
    maxFileSizeBytes: parsePositiveInt(source.MAX_FILE_SIZE_BYTES, DEFAULT_MAX_FILE_SIZE_BYTES),
    maxVolumeSizeBytes: parsePositiveInt(source.MAX_VOLUME_SIZE_BYTES, DEFAULT_MAX_VOLUME_SIZE_BYTES),
  };
}

export const serverEnv = readServerEnv();

/**
 * URL Constants for mdplane
 *
 * Single source of truth for all URLs across the monorepo.
 * Import from @mdplane/shared instead of hardcoding URLs.
 */

/**
 * Production URLs for mdplane services
 */
export const URLS = {
  /** Main API endpoint */
  API: 'https://api.mdplane.dev',
  /** Web application */
  APP: 'https://app.mdplane.dev',
  /** Documentation site */
  DOCS: 'https://docs.mdplane.dev',
  /** Landing page */
  LANDING: 'https://mdplane.dev',
  /** Status page */
  STATUS: 'https://status.mdplane.dev',
  /** WebSocket endpoint */
  WS: 'wss://api.mdplane.dev/ws',
  /** GitHub repository */
  GITHUB: 'https://github.com/albri/mdplane',
  /** GitHub Actions */
  GITHUB_ACTIONS: 'https://github.com/albri/mdplane/actions',
  /** Agent Skills (for AI agents to learn mdplane) */
  SKILLS: 'https://github.com/albri/mdplane/tree/main/packages/skills',
  /** Contact email */
  CONTACT_EMAIL: 'hello@mdplane.dev',
  /** Cookie domain for cross-subdomain auth */
  COOKIE_DOMAIN: '.mdplane.dev',
} as const;

/**
 * Development URLs for local testing
 */
export const DEV_URLS = {
  /** Local API server */
  API: 'http://127.0.0.1:3001',
  /** Local web application */
  APP: 'http://127.0.0.1:3000',
} as const;

/**
 * Get the API URL based on environment
 * Prefers NEXT_PUBLIC_API_URL env var, falls back to production URL
 */
export function getApiUrl(): string {
  if (typeof process !== 'undefined') {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl != null && apiUrl !== '') {
      return apiUrl;
    }
  }
  return URLS.API;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  if (typeof process !== 'undefined') {
    return process.env.NODE_ENV === 'development';
  }
  return false;
}


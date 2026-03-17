// Canonical hosted URLs used across docs, app metadata, and links.
export const URLS = {
  API: 'https://api.mdplane.dev',
  APP: 'https://app.mdplane.dev',
  DOCS: 'https://docs.mdplane.dev',
  LANDING: 'https://mdplane.dev',
  STATUS: 'https://status.mdplane.dev',
  WS: 'wss://api.mdplane.dev/ws',
  GITHUB: 'https://github.com/albri/mdplane',
  GITHUB_ACTIONS: 'https://github.com/albri/mdplane/actions',
  SKILLS: 'https://github.com/albri/mdplane/tree/main/packages/skills',
  CONTACT_EMAIL: 'hello@mdplane.dev',
  COOKIE_DOMAIN: '.mdplane.dev',
} as const;

// Local defaults for development and tests.
export const DEV_URLS = {
  API: 'http://127.0.0.1:3001',
  APP: 'http://127.0.0.1:3000',
} as const;

// Browser-facing surfaces prefer NEXT_PUBLIC_API_URL when explicitly configured.
export function getApiUrl(): string {
  if (typeof process !== 'undefined') {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl != null && apiUrl !== '') {
      return apiUrl;
    }
  }
  return URLS.API;
}

// Shared helper for metadata/defaults that need to branch on NODE_ENV.
export function isDevelopment(): boolean {
  if (typeof process !== 'undefined') {
    return process.env.NODE_ENV === 'development';
  }
  return false;
}

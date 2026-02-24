/**
 * Frontend Route Constants
 *
 * Single source of truth for frontend routes in the mdplane web application.
 * All route paths should be imported from here to prevent drift.
 *
 * Route categories:
 * - CONTROL_FRONTEND_ROUTES: /control/* authenticated control pages
 * - AUTH_FRONTEND_ROUTES: /login, /claim/* authentication flows
 * - WORKSPACE_FRONTEND_ROUTES: /launch and /r capability URL workspace views
 * - LANDING_ROUTES: /, /privacy, /terms marketing pages
 *
 * @module routes/frontend
 */

export const CONTROL_FRONTEND_ROUTES = {
  root: '/control' as const,
  workspace: (workspaceId: string) => `/control/${workspaceId}` as const,
  apiKeys: (workspaceId: string) => `/control/${workspaceId}/api-keys` as const,
  webhooks: (workspaceId: string) => `/control/${workspaceId}/webhooks` as const,
  orchestration: (workspaceId: string) => `/control/${workspaceId}/orchestration` as const,
  settings: (workspaceId: string) => `/control/${workspaceId}/settings` as const,
} as const;

export const AUTH_FRONTEND_ROUTES = {
  login: '/login' as const,
  loginWithRedirect: (next: string) =>
    `/login?next=${encodeURIComponent(next)}` as const,
  claim: '/claim' as const,
  claimWorkspace: (writeKey: string) => `/claim/${writeKey}` as const,
  bootstrap: '/bootstrap' as const,
} as const;

export const WORKSPACE_FRONTEND_ROUTES = {
  launch: '/launch' as const,

  // Read viewer
  read: (key: string) => `/r/${key}` as const,
  readFile: (key: string, path: string) => `/r/${key}/${path}` as const,
} as const;

export const LANDING_ROUTES = {
  home: '/' as const,
  privacy: '/privacy' as const,
  terms: '/terms' as const,
} as const;

export const ROUTE_MATCHERS = {
  control: '/control/:path*' as const,
  controlPrefix: '/control' as const,
} as const;

export const FRONTEND_ROUTES = {
  control: CONTROL_FRONTEND_ROUTES,
  auth: AUTH_FRONTEND_ROUTES,
  workspace: WORKSPACE_FRONTEND_ROUTES,
  landing: LANDING_ROUTES,
  matchers: ROUTE_MATCHERS,
} as const;


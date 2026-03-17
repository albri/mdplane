// Claimed-workspace control plane routes.
export const CONTROL_FRONTEND_ROUTES = {
  root: '/control' as const,
  workspace: (workspaceId: string) => `/control/${workspaceId}` as const,
  apiKeys: (workspaceId: string) => `/control/${workspaceId}/api-keys` as const,
  webhooks: (workspaceId: string) => `/control/${workspaceId}/webhooks` as const,
  orchestration: (workspaceId: string) => `/control/${workspaceId}/orchestration` as const,
  settings: (workspaceId: string) => `/control/${workspaceId}/settings` as const,
} as const;

// Login and workspace-claiming routes.
export const AUTH_FRONTEND_ROUTES = {
  login: '/login' as const,
  loginWithRedirect: (next: string) =>
    `/login?next=${encodeURIComponent(next)}` as const,
  claim: '/claim' as const,
  claimWorkspace: (writeKey: string) => `/claim/${writeKey}` as const,
} as const;

// Capability-first workspace reader routes.
export const WORKSPACE_FRONTEND_ROUTES = {
  read: (key: string) => `/r/${key}` as const,
  readFile: (key: string, path: string) => `/r/${key}/${path}` as const,
} as const;

// Public marketing/legal routes.
export const LANDING_ROUTES = {
  home: '/' as const,
  privacy: '/privacy' as const,
  terms: '/terms' as const,
} as const;

// Matchers used by middleware and route guards.
export const ROUTE_MATCHERS = {
  control: '/control/:path*' as const,
  controlPrefix: '/control' as const,
} as const;

// Grouped frontend routes export.
export const FRONTEND_ROUTES = {
  control: CONTROL_FRONTEND_ROUTES,
  auth: AUTH_FRONTEND_ROUTES,
  workspace: WORKSPACE_FRONTEND_ROUTES,
  landing: LANDING_ROUTES,
  matchers: ROUTE_MATCHERS,
} as const;

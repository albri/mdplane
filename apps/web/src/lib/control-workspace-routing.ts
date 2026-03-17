export const CONTROL_LAST_WORKSPACE_COOKIE = 'mdplane_last_workspace_id'

const WORKSPACE_ID_PATTERN = /^ws_[A-Za-z0-9][A-Za-z0-9_-]*$/

export function isWorkspaceId(value: string): boolean {
  return WORKSPACE_ID_PATTERN.test(value)
}

export function extractControlWorkspaceId(pathname: string): string | null {
  if (!pathname.startsWith('/control')) {
    return null
  }

  const segments = pathname.split('/').filter(Boolean)
  const workspaceId = segments[1]

  if (!workspaceId || !isWorkspaceId(workspaceId)) {
    return null
  }

  return workspaceId
}

export function buildControlWorkspacePath(pathname: string, nextWorkspaceId: string): string {
  if (!isWorkspaceId(nextWorkspaceId)) {
    return '/control'
  }

  if (!pathname.startsWith('/control')) {
    return `/control/${nextWorkspaceId}`
  }

  const segments = pathname.split('/').filter(Boolean)
  const maybeWorkspaceId = segments[1]

  if (!maybeWorkspaceId || !isWorkspaceId(maybeWorkspaceId)) {
    return `/control/${nextWorkspaceId}`
  }

  segments[1] = nextWorkspaceId
  return `/${segments.join('/')}`
}


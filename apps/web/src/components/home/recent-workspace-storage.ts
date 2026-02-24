export const RECENT_WORKSPACE_STORAGE_KEY = 'mdplane_recent_workspace_urls'
export const MAX_RECENT_WORKSPACE_URLS = 5

export interface RecentWorkspaceUrl {
  url: string
  label: string
  addedAt: string
}

export interface RecentWorkspaceState {
  saveEnabled: boolean
  urls: RecentWorkspaceUrl[]
}

const DEFAULT_STATE: RecentWorkspaceState = {
  saveEnabled: false,
  urls: [],
}

function isRecentWorkspaceUrl(value: unknown): value is RecentWorkspaceUrl {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RecentWorkspaceUrl>
  return (
    typeof candidate.url === 'string'
    && candidate.url.startsWith('/')
    && typeof candidate.label === 'string'
    && typeof candidate.addedAt === 'string'
  )
}

export function deserializeRecentWorkspaceState(raw: string | null): RecentWorkspaceState {
  if (!raw) return DEFAULT_STATE

  try {
    const parsed = JSON.parse(raw) as {
      saveEnabled?: unknown
      urls?: unknown
    }

    if (parsed.saveEnabled !== true) {
      return DEFAULT_STATE
    }

    const urls = Array.isArray(parsed.urls)
      ? parsed.urls.filter(isRecentWorkspaceUrl).slice(0, MAX_RECENT_WORKSPACE_URLS)
      : []

    return {
      saveEnabled: true,
      urls,
    }
  } catch {
    return DEFAULT_STATE
  }
}

export function serializeRecentWorkspaceState(state: RecentWorkspaceState): string {
  return JSON.stringify({
    saveEnabled: state.saveEnabled,
    urls: state.saveEnabled ? state.urls.slice(0, MAX_RECENT_WORKSPACE_URLS) : [],
  })
}

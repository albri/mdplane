interface ResolvePostLoginRedirectOptions {
  locationSearch: string
  storedRedirect: string | null
  fallbackPath: string
}

function isSafeInternalPath(value: string | null | undefined): value is string {
  return Boolean(value && value.startsWith('/'))
}

export function extractSafeNextPath(locationSearch: string): string | null {
  const next = new URLSearchParams(locationSearch).get('next')
  return isSafeInternalPath(next) ? next : null
}

export function resolvePostLoginRedirect({
  locationSearch,
  storedRedirect,
  fallbackPath,
}: ResolvePostLoginRedirectOptions): string {
  const nextFromQuery = extractSafeNextPath(locationSearch)
  if (nextFromQuery) return nextFromQuery

  if (isSafeInternalPath(storedRedirect)) return storedRedirect

  return fallbackPath
}

export const CAPABILITY_PROXY_BASE_PATH = '/api/capability' as const

export function capabilityProxyRoute(capabilityRoute: string): string {
  const normalized = capabilityRoute.startsWith('/') ? capabilityRoute : `/${capabilityRoute}`
  return `${CAPABILITY_PROXY_BASE_PATH}${normalized}`
}

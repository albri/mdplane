import { webEnv } from '../../config/env'

export function getBackendBaseUrl(): string {
  const apiUrl = webEnv.apiInternalUrl
  return apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
}

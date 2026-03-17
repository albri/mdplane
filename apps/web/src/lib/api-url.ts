import { webEnv } from '@/config/env'

export function getApiBaseUrl(): string {
  return webEnv.apiUrl
}

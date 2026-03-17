import { createAuthClient } from 'better-auth/react'
import { getApiBaseUrl } from './api-url'

/**
 * Get the auth API base URL.
 *
 * ARCHITECTURE: Auth calls go directly to the configured API origin
 * (no proxy through Next.js). This ensures cookies are set on the API domain and avoids
 * state_mismatch errors during OAuth flow.
 *
 * Example: https://api.mdplane.dev/api/auth
 */
const getAuthBaseUrl = (): string => {
  // Use the API URL directly - NOT through the Next.js proxy
  const apiUrl = getApiBaseUrl()
  const origin = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
  return `${origin}/api/auth`
}

const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  fetchOptions: {
    credentials: 'include',
  },
})

export const { signIn, signOut, useSession } = authClient

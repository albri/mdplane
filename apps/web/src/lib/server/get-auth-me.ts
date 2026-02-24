import { AUTH_ROUTES, type MeResponse } from '@mdplane/shared'
import { getBackendBaseUrl } from './get-backend-base-url'

type AuthMeSuccess = { status: 'ok'; data: MeResponse['data'] }
type AuthMeUnauthenticated = { status: 'unauthenticated' }
type AuthMeError = { status: 'error' }

export type GetAuthMeResult = AuthMeSuccess | AuthMeUnauthenticated | AuthMeError

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export async function getAuthMe(cookieHeader: string, fetchImpl: FetchImpl = fetch): Promise<GetAuthMeResult> {
  if (!cookieHeader) {
    return { status: 'unauthenticated' }
  }

  try {
    const response = await fetchImpl(`${getBackendBaseUrl()}${AUTH_ROUTES.me}`, {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
        accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { status: 'unauthenticated' }
      }

      return { status: 'error' }
    }

    const payload = (await response.json()) as MeResponse
    if (!payload.ok) {
      return { status: 'error' }
    }

    return { status: 'ok', data: payload.data }
  } catch {
    return { status: 'error' }
  }
}

export type GetSessionResponse = {
  session?: { user?: unknown }
  user?: unknown
}

export const CONTROL_AUTH_TIMEOUT_MS = 1500

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

type SessionValidationInput = {
  apiUrl: string
  cookieHeader: string
  timeoutMs?: number
  fetchImpl?: FetchLike
}

export async function validateSessionWithTimeout({
  apiUrl,
  cookieHeader,
  timeoutMs = CONTROL_AUTH_TIMEOUT_MS,
  fetchImpl = fetch as FetchLike,
}: SessionValidationInput): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetchImpl(`${apiUrl}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
        accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      return false
    }

    const json = (await res.json()) as GetSessionResponse
    return !!(json?.user || json?.session?.user)
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

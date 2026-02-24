import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { AUTH_FRONTEND_ROUTES, ROUTE_MATCHERS } from '@mdplane/shared'
import { validateSessionWithTimeout } from './lib/session-validation'
import { CONTROL_LAST_WORKSPACE_COOKIE, extractControlWorkspaceId } from './lib/control-workspace-routing'
import { getBackendBaseUrl } from './lib/server/get-backend-base-url'
import { webEnv } from './config/env'

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (!pathname.startsWith(ROUTE_MATCHERS.controlPrefix)) {
    return NextResponse.next()
  }
  if (!webEnv.governedModeEnabled) {
    return NextResponse.next()
  }

  const cookieHeader = request.headers.get('cookie') ?? ''
  const sessionToken = request.cookies.get('__Secure-better-auth.session_token')?.value
    ?? request.cookies.get('better-auth.session_token')?.value

  if (sessionToken) {
    const hasValidSession = await validateSessionWithTimeout({
      apiUrl: getBackendBaseUrl(),
      cookieHeader,
    })

    if (hasValidSession) {
      const response = NextResponse.next()
      const workspaceId = extractControlWorkspaceId(pathname)
      if (workspaceId) {
        response.cookies.set(CONTROL_LAST_WORKSPACE_COOKIE, workspaceId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/control',
          maxAge: 60 * 60 * 24 * 365,
        })
      }
      return response
    }
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = AUTH_FRONTEND_ROUTES.login
  loginUrl.searchParams.set('next', `${pathname}${search}`)

  return NextResponse.redirect(loginUrl)
}

export const proxyConfig = {
  matcher: ['/control/:path*'],
}

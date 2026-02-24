'use client'

import { useSession as useBetterAuthSession, signOut } from '@/lib/auth-client'

/**
 * Frontend session user type.
 *
 * NOTE: This is NOT from the OpenAPI spec - it's a frontend-only type that maps
 * BetterAuth's session user to our application's user model.
 * The API's MeResponse['data'] type has different fields (workspaces, created, etc.)
 * that are not relevant for session display.
 */
export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  emailVerified: boolean
}

/**
 * Frontend session state.
 *
 * NOTE: This is NOT from the OpenAPI spec - it's a frontend-only wrapper for
 * managing client-side authentication state with BetterAuth.
 */
export interface Session {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useSession(): Session & {
  logout: () => Promise<void>
  refetch: () => void
} {
  const { data: session, isPending, refetch } = useBetterAuthSession()

  // Map BetterAuth user to our User type (handling undefined -> null)
  const user: User | null = session?.user ? {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    emailVerified: session.user.emailVerified,
  } : null

  return {
    user,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    logout: async () => {
      await signOut()
    },
    refetch,
  }
}


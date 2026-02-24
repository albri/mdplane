'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useSession as useBetterAuthSession } from '@/lib/auth-client'

interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  emailVerified: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, isPending } = useBetterAuthSession()

  const logout = async () => {
    const { signOut } = await import('@/lib/auth-client')
    await signOut()
  }

  const user: User | null = session?.user ? {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    emailVerified: session.user.emailVerified,
  } : null

  const value: AuthContextType = {
    user,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


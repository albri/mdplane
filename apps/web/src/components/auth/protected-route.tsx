'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks'
import { AUTH_FRONTEND_ROUTES } from '@mdplane/shared'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  fallbackUrl?: string
}

export function ProtectedRoute({ children, fallbackUrl = AUTH_FRONTEND_ROUTES.login }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search)
      }
      router.replace(fallbackUrl)
    }
  }, [isAuthenticated, isLoading, router, fallbackUrl])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}



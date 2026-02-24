'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { getApiBaseUrl } from '@/lib/api-url'
import { useQueryClient } from '@tanstack/react-query'
import { AUTH_ME_QUERY_KEY } from '@/lib/auth-me-query-key'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@mdplane/ui/ui/button'
import { BorderedIcon } from '@mdplane/ui/ui/bordered-icon'
import { AUTH_FRONTEND_ROUTES, CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import Link from 'next/link'

interface ClaimResult {
  ok: boolean
  data?: {
    workspaceId: string
    claimed: boolean
  }
  error?: {
    code: string
    message: string
  }
}

type ClaimErrorCode =
  | 'ALREADY_CLAIMED'
  | 'INVALID_KEY'
  | 'NOT_FOUND'
  | 'KEY_REVOKED'
  | 'KEY_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'UNAUTHORIZED'

interface ErrorInfo {
  title: string
  message: string
}

function getErrorInfo(code: ClaimErrorCode | string, message?: string): ErrorInfo {
  const errors: Record<ClaimErrorCode, ErrorInfo> = {
    ALREADY_CLAIMED: {
      title: 'Already Claimed',
      message: 'This workspace has already been claimed by another user.',
    },
    INVALID_KEY: {
      title: 'Invalid Key',
      message: 'The claim key is invalid or has been deleted.',
    },
    NOT_FOUND: {
      title: 'Invalid Key',
      message: 'The workspace was not found. The key may be invalid or deleted.',
    },
    KEY_REVOKED: {
      title: 'Key Revoked',
      message: 'This claim key has been revoked and can no longer be used.',
    },
    KEY_EXPIRED: {
      title: 'Key Expired',
      message: 'This claim key has expired.',
    },
    RATE_LIMITED: {
      title: 'Too Many Attempts',
      message: 'You have made too many claim attempts. Please wait a moment.',
    },
    NETWORK_ERROR: {
      title: 'Connection Error',
      message: 'Failed to connect to the server.',
    },
    SERVER_ERROR: {
      title: 'Server Error',
      message: 'Something went wrong on our end.',
    },
    UNAUTHORIZED: {
      title: 'Authentication Required',
      message: 'You need to be signed in to claim a workspace.',
    },
  }

  return errors[code as ClaimErrorCode] || {
    title: 'Claim Failed',
    message: message || 'An unexpected error occurred.',
  }
}

export default function ClaimWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const writeKey = params.writeKey as string
  const { data: session, isPending: isSessionLoading } = useSession()

  const [claimState, setClaimState] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle')
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)

  const claimWorkspace = useCallback(async () => {
    setClaimState('claiming')
    setErrorInfo(null)

    try {
      const apiUrl = getApiBaseUrl()
      const response = await fetch(`${apiUrl}/w/${writeKey}/claim`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result: ClaimResult = await response.json()
      setClaimResult(result)
      
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY })
        setClaimState('success')
      } else {
        setClaimState('error')
        setErrorInfo(getErrorInfo(result.error?.code || 'SERVER_ERROR', result.error?.message))
      }
    } catch {
      setClaimResult({
        ok: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server. Please try again.',
        },
      })
      setClaimState('error')
      setErrorInfo(getErrorInfo('NETWORK_ERROR'))
    }
  }, [writeKey, queryClient])

  useEffect(() => {
    if (isSessionLoading) return

    if (!session?.user) {
      router.replace(AUTH_FRONTEND_ROUTES.loginWithRedirect(`/claim/${writeKey}`))
      return
    }

    if (claimState === 'idle') {
      claimWorkspace()
    }
  }, [session, isSessionLoading, claimState, writeKey, router, claimWorkspace])

  if (isSessionLoading || claimState === 'idle' || claimState === 'claiming') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Spinner size="lg" label={isSessionLoading ? 'Checking authentication...' : 'Claiming workspace...'} />
            <p className="text-sm text-muted-foreground">
              {isSessionLoading ? 'Checking authentication...' : 'Claiming workspace...'}
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (claimState === 'success' && claimResult?.data) {
    const controlHref = CONTROL_FRONTEND_ROUTES.workspace(claimResult.data.workspaceId)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <BorderedIcon variant="success" className="mx-auto mb-4 h-12 w-12">
              <CheckCircle className="h-6 w-6" />
            </BorderedIcon>
            <CardTitle className="text-xl font-semibold">Workspace Claimed!</CardTitle>
            <CardDescription>
              Your workspace is now linked to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Link href={controlHref} prefetch={false} className={buttonVariants({ className: 'w-full' })}>
              Go to Control
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <BorderedIcon variant="error" className="mx-auto mb-4 h-12 w-12">
            <AlertCircle className="h-6 w-6" />
          </BorderedIcon>
          <CardTitle className="text-xl font-semibold">{errorInfo?.title || 'Claim Failed'}</CardTitle>
          <CardDescription>{errorInfo?.message || claimResult?.error?.message || 'An unexpected error occurred.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={() => setClaimState('idle')} className="w-full">
            Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

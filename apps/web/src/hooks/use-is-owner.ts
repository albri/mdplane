'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from './use-session'
import { useCapabilityInfo } from './use-capability-info'
import { getCurrentUser } from '@/lib/api'
import { AUTH_ME_QUERY_KEY } from '@/lib/auth-me-query-key'
import type { MeResponse } from '@mdplane/shared'

interface UseIsOwnerResult {
  isOwner: boolean
  workspaceId: string | null
  isLoading: boolean
}

/**
 * Hook to check if the current user owns the workspace associated with a capability key.
 * 
 * Returns:
 * - isOwner: true if the user is logged in AND owns the workspace
 * - workspaceId: the workspace ID (if valid key and user is owner)
 * - isLoading: true while checking
 * 
 * Important: Returns false while loading to prevent flash of banner.
 */
export function useIsOwner(capabilityKey: string | undefined): UseIsOwnerResult {
  const { isAuthenticated, isLoading: sessionLoading } = useSession()
  
  // Only fetch capability info if user is logged in
  const { data: capabilityInfo, isLoading: capabilityLoading } = useCapabilityInfo(
    isAuthenticated ? capabilityKey : undefined
  )

  // Only fetch user workspaces if logged in
  const { data: userWorkspaces = [], isLoading: userLoading } = useQuery<MeResponse['data']['workspaces']>({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: async () => {
      const response = await getCurrentUser()
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to fetch user')
      }
      return response.data?.workspaces ?? []
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const result = useMemo(() => {
    // Not logged in - definitely not owner
    if (!isAuthenticated) {
      return { isOwner: false, workspaceId: null, isLoading: false }
    }

    // Still loading
    if (sessionLoading || capabilityLoading || userLoading) {
      return { isOwner: false, workspaceId: null, isLoading: true }
    }

    // No capability info or user data
    if (!capabilityInfo?.scopeId) {
      return { isOwner: false, workspaceId: null, isLoading: false }
    }

    // Check if user owns this workspace
    const workspaceId = capabilityInfo.scopeId
    const isOwner = userWorkspaces.some((ws) => ws.id === workspaceId)

    return { isOwner, workspaceId: isOwner ? workspaceId : null, isLoading: false }
  }, [isAuthenticated, sessionLoading, capabilityLoading, userLoading, capabilityInfo, userWorkspaces])

  return result
}

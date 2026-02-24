'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getOrchestration,
  renewClaim,
  completeClaim,
  cancelClaim,
  markClaimBlocked,
  type ControlClaim,
} from '@/lib/api'
import type { OrchestrationClaim } from '@mdplane/shared'

function transformClaim(claim: OrchestrationClaim): ControlClaim {
  return {
    id: claim.id,
    taskId: claim.taskId,
    path: claim.file.path,
    author: claim.author,
    expiresAt: claim.expiresAt,
    expiresInSeconds: claim.expiresInSeconds,
    status: claim.status,
  }
}

const UI_CLAIM_TAB_STATUSES = new Set(['active', 'expired', 'completed'])
const ORCHESTRATION_STATUSES_FOR_CLAIMS = new Set(['pending', 'claimed', 'stalled', 'cancelled'])
const CONTROL_CLAIMS_QUERY_KEY = 'control-claims'
const CONTROL_ORCHESTRATION_QUERY_KEY = 'control-orchestration'

export function toOrchestrationStatusFilterForClaims(status?: string): string | undefined {
  if (!status) {
    return undefined
  }

  const normalized = status.trim().toLowerCase()
  if (!normalized || UI_CLAIM_TAB_STATUSES.has(normalized)) {
    return undefined
  }

  return ORCHESTRATION_STATUSES_FOR_CLAIMS.has(normalized) ? normalized : undefined
}

export function useControlClaims(workspaceId: string | null, status?: string) {
  const orchestrationStatus = toOrchestrationStatusFilterForClaims(status)
  const filters = orchestrationStatus ? { status: orchestrationStatus } : undefined

  return useQuery({
    queryKey: [CONTROL_CLAIMS_QUERY_KEY, workspaceId, orchestrationStatus],
    queryFn: async (): Promise<ControlClaim[]> => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await getOrchestration(workspaceId, filters)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to fetch orchestration')
      }
      const claims = response.data?.claims ?? []
      return claims.map(transformClaim)
    },
    enabled: !!workspaceId,
    staleTime: 10_000,
    refetchInterval: false,
    retry: false,
    placeholderData: (previousData) => previousData,
  })
}

export function useRenewClaim(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ claimId, expiresInSeconds }: { claimId: string; expiresInSeconds?: number }) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await renewClaim(workspaceId, claimId, expiresInSeconds)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to renew claim')
      }
      return response.data
    },
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: [CONTROL_CLAIMS_QUERY_KEY, workspaceId] })
        queryClient.invalidateQueries({ queryKey: [CONTROL_ORCHESTRATION_QUERY_KEY, workspaceId] })
      }
    },
  })
}

export function useCompleteClaim(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ claimId, content }: { claimId: string; content?: string }) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await completeClaim(workspaceId, claimId, content)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to complete claim')
      }
      return response.data
    },
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: [CONTROL_CLAIMS_QUERY_KEY, workspaceId] })
        queryClient.invalidateQueries({ queryKey: [CONTROL_ORCHESTRATION_QUERY_KEY, workspaceId] })
      }
    },
  })
}

export function useCancelClaim(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason?: string }) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await cancelClaim(workspaceId, claimId, reason)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to cancel claim')
      }
      return response.data
    },
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: [CONTROL_CLAIMS_QUERY_KEY, workspaceId] })
        queryClient.invalidateQueries({ queryKey: [CONTROL_ORCHESTRATION_QUERY_KEY, workspaceId] })
      }
    },
  })
}

export function useMarkClaimBlocked(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason: string }) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await markClaimBlocked(workspaceId, claimId, reason)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to mark claim as blocked')
      }
      return response.data
    },
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: [CONTROL_CLAIMS_QUERY_KEY, workspaceId] })
        queryClient.invalidateQueries({ queryKey: [CONTROL_ORCHESTRATION_QUERY_KEY, workspaceId] })
      }
    },
  })
}

// Re-export generated type for convenience
export type { ControlClaim }


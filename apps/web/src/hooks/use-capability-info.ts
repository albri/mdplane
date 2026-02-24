'use client'

import { useQuery } from '@tanstack/react-query'
import { checkCapabilities, type CapabilityCheckResult } from '@/lib/api'

/**
 * Hook to get capability info (including workspaceId) from a capability key.
 * Uses the /capabilities/check endpoint to validate the key and get scope info.
 */
export function useCapabilityInfo(capabilityKey: string | undefined) {
  return useQuery({
    queryKey: ['capability-info', capabilityKey],
    queryFn: async (): Promise<CapabilityCheckResult | null> => {
      if (!capabilityKey) return null

      const response = await checkCapabilities([capabilityKey])
      if (!response.ok || !response.data?.results?.length) {
        return null
      }

      return response.data.results[0]
    },
    enabled: !!capabilityKey,
    staleTime: 5 * 60 * 1000, // 5 minutes - capability info rarely changes
  })
}


'use client'

import { useQuery } from '@tanstack/react-query'
import { LIMITS, type OrchestrationReadOnlyResponse, type OrchestrationSummary, type OrchestrationTask as ApiOrchestrationTask } from '@mdplane/shared'
import { getOrchestration, type OrchestrationFilters } from '@/lib/api'

const CONTROL_ORCHESTRATION_QUERY_KEY = 'control-orchestration'
const ORCHESTRATION_FETCH_LIMIT = LIMITS.LIST_LIMIT_MAX

export type OrchestrationStatus = keyof OrchestrationSummary
export type OrchestrationTask = ApiOrchestrationTask

export interface OrchestrationData {
  tasks: OrchestrationTask[]
  summary: OrchestrationSummary
  pagination: {
    hasMore: boolean
    cursor?: string
  }
}

export const EMPTY_ORCHESTRATION_SUMMARY: OrchestrationSummary = {
  pending: 0,
  claimed: 0,
  completed: 0,
  stalled: 0,
  cancelled: 0,
}

export function transformOrchestrationResponse(data: {
  summary: OrchestrationSummary
  tasks: OrchestrationReadOnlyResponse['data']['tasks']
  pagination?: OrchestrationReadOnlyResponse['data']['pagination']
}): OrchestrationData {
  return {
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    summary: data.summary,
    pagination: {
      hasMore: Boolean(data.pagination?.hasMore),
      cursor: data.pagination?.cursor,
    },
  }
}

function createEmptyOrchestrationData(): OrchestrationData {
  return {
    tasks: [],
    summary: EMPTY_ORCHESTRATION_SUMMARY,
    pagination: {
      hasMore: false,
    },
  }
}

export function useControlOrchestration(workspaceId: string | null, filters?: OrchestrationFilters) {
  const query = useQuery({
    queryKey: [CONTROL_ORCHESTRATION_QUERY_KEY, workspaceId, filters, ORCHESTRATION_FETCH_LIMIT],
    queryFn: async (): Promise<OrchestrationData> => {
      if (!workspaceId) throw new Error('No workspace selected')

      const response = await getOrchestration(workspaceId, filters, {
        limit: ORCHESTRATION_FETCH_LIMIT,
      })

      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to fetch orchestration data')
      }

      if (!response.data) {
        return createEmptyOrchestrationData()
      }

      return transformOrchestrationResponse(response.data)
    },
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
    refetchInterval: 45_000,
    retry: false,
  })

  return {
    ...query,
    data: query.data ?? createEmptyOrchestrationData(),
  }
}

export type { OrchestrationFilters }

'use client'

import { useQuery } from '@tanstack/react-query'
import { CAPABILITY_ROUTES, LIMITS, type Error as ApiErrorResponse, type OrchestrationReadOnlyResponse } from '@mdplane/shared'
import { transformOrchestrationResponse, type OrchestrationData, type OrchestrationFilters } from './use-control-orchestration'
import { capabilityProxyRoute } from '@/lib/capability/proxy-route'

type BackendOrchestrationResponse = OrchestrationReadOnlyResponse | ApiErrorResponse

const ORCHESTRATION_FETCH_LIMIT = LIMITS.LIST_LIMIT_MAX

function buildFiltersSearchParams(
  filters?: OrchestrationFilters
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters?.status) params.set('status', filters.status)
  if (filters?.priority) params.set('priority', filters.priority)
  if (filters?.agent) params.set('agent', filters.agent)
  if (filters?.file) params.set('file', filters.file)
  if (filters?.folder) params.set('folder', filters.folder)
  params.set('limit', String(ORCHESTRATION_FETCH_LIMIT))

  return params
}

export function useWorkspaceOrchestration(readKey: string | null, filters?: OrchestrationFilters) {
  return useQuery({
    queryKey: ['capability-orchestration', readKey, filters, ORCHESTRATION_FETCH_LIMIT],
    queryFn: async (): Promise<OrchestrationData> => {
      if (!readKey) throw new Error('No capability key provided')

      const query = buildFiltersSearchParams(filters).toString()
      const baseRoute = capabilityProxyRoute(
        CAPABILITY_ROUTES.readOrchestration(encodeURIComponent(readKey))
      )
      const orchestrationUrl = query
        ? `${baseRoute}?${query}`
        : baseRoute
      const response = await fetch(orchestrationUrl)
      const raw = await response.text()
      if (!raw.trim()) {
        throw new Error('Failed to fetch orchestration data')
      }

      const json: BackendOrchestrationResponse = JSON.parse(raw)

      if (!json.ok) {
        throw new Error(json.error.message || 'Failed to fetch orchestration data')
      }

      return transformOrchestrationResponse(json.data)
    },
    enabled: Boolean(readKey),
    staleTime: 10_000,
    refetchInterval: 45_000,
    retry: false,
  })
}

import type { OrchestrationFilters } from '@/hooks'
import type { OrchestrationViewFilters } from './orchestration-filter-bar'

export const DEFAULT_ORCHESTRATION_VIEW_FILTERS: OrchestrationViewFilters = {
  status: [],
  priority: [],
  agent: null,
  folder: null,
}

export function buildApiOrchestrationFilters(
  filters: OrchestrationViewFilters
): OrchestrationFilters | undefined {
  const next: OrchestrationFilters = {}

  if (filters.status.length > 0) {
    next.status = filters.status.join(',')
  }

  if (filters.priority.length > 0) {
    next.priority = filters.priority.join(',')
  }

  if (filters.agent) {
    next.agent = filters.agent
  }

  if (filters.folder) {
    next.folder = filters.folder
  }

  return Object.keys(next).length > 0 ? next : undefined
}

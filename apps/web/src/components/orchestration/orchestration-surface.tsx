'use client'

import { useMemo } from 'react'
import type { OrchestrationData, OrchestrationTask } from '@/hooks'
import { OrchestrationSections } from './orchestration-sections'
import { OrchestrationEmpty } from './orchestration-empty'
import { OrchestrationAllDone } from './orchestration-all-done'
import { OrchestrationSkeleton } from './orchestration-skeleton'
import { OrchestrationError } from './orchestration-error'
import { OrchestrationFilterBar, type OrchestrationViewFilters } from './orchestration-filter-bar'

interface OrchestrationSurfaceProps {
  data: OrchestrationData
  isLoading: boolean
  error: Error | null
  filters: OrchestrationViewFilters
  onRefresh: () => void
  onFiltersChange: (next: OrchestrationViewFilters) => void
  getTaskHref?: (task: OrchestrationTask) => string | null
  showTakeAction?: boolean
  onTakeAction?: (task: OrchestrationTask) => void
}

function getFolderPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const lastSlash = normalizedPath.lastIndexOf('/')
  return lastSlash > 0 ? normalizedPath.slice(0, lastSlash) : '/'
}

function getTotalFromSummary(summary: OrchestrationData['summary']): number {
  return summary.pending + summary.claimed + summary.completed + summary.stalled + summary.cancelled
}

function hasIncompleteTasks(tasks: OrchestrationTask[]): boolean {
  return tasks.some((task) => task.status === 'pending' || task.status === 'claimed' || task.status === 'stalled')
}

function hasResolvedTasks(tasks: OrchestrationTask[]): boolean {
  return tasks.some((task) => task.status === 'completed' || task.status === 'cancelled')
}

export function OrchestrationSurface({
  data,
  isLoading,
  error,
  filters,
  onRefresh,
  onFiltersChange,
  getTaskHref,
  showTakeAction = false,
  onTakeAction,
}: OrchestrationSurfaceProps) {
  const agents = useMemo(() => {
    const values = new Set<string>()
    for (const task of data.tasks) {
      if (task.claim?.author) values.add(task.claim.author)
    }
    return [...values].sort((a, b) => a.localeCompare(b))
  }, [data.tasks])

  const folders = useMemo(() => {
    const values = new Set<string>()
    for (const task of data.tasks) {
      values.add(getFolderPath(task.file.path))
    }
    return [...values].sort((a, b) => a.localeCompare(b))
  }, [data.tasks])

  const responseTotalCount = getTotalFromSummary(data.summary)
  const visibleTotalCount = getTotalFromSummary(data.summary)
  const hasVisibleTasks = visibleTotalCount > 0
  const hasVisibleIncompleteTasks = hasIncompleteTasks(data.tasks)
  const hasVisibleResolvedTasks = hasResolvedTasks(data.tasks)
  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    Boolean(filters.agent) ||
    Boolean(filters.folder)

  const renderContent = () => {
    if (isLoading) {
      return <OrchestrationSkeleton />
    }

    if (error) {
      return <OrchestrationError onRetry={onRefresh} />
    }

    if (responseTotalCount === 0 && !hasActiveFilters) {
      return <OrchestrationEmpty />
    }

    if (!hasVisibleTasks && hasActiveFilters) {
      return (
        <p className='rounded-xl border border-border/80 bg-secondary px-4 py-6 text-sm text-muted-foreground'>
          No tasks match the current filters.
        </p>
      )
    }

    if (!hasVisibleTasks || (!hasVisibleIncompleteTasks && !hasVisibleResolvedTasks)) {
      return <OrchestrationAllDone doneCount={data.summary.completed + data.summary.cancelled} />
    }

    return (
      <OrchestrationSections
        data={data}
        getTaskHref={getTaskHref}
        showTakeAction={showTakeAction}
        onTakeAction={onTakeAction}
      />
    )
  }

  return (
    <div className='overflow-hidden rounded-xl border border-border/80 bg-secondary'>
      <div className='px-4 py-3'>
        <OrchestrationFilterBar
          filters={filters}
          agents={agents}
          folders={folders}
          onFiltersChange={onFiltersChange}
        />
      </div>

      <div className='space-y-4 rounded-xl bg-card p-4'>
        {renderContent()}
        {data.pagination.hasMore ? (
          <p className='text-xs text-muted-foreground'>
            API result is paginated; currently rendering {visibleTotalCount} task(s) from this response page.
          </p>
        ) : null}
      </div>
    </div>
  )
}

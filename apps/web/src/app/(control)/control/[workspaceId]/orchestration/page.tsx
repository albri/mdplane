'use client'

import { useMemo, useState } from 'react'
import { ControlContent, ControlHeader } from '@/components/control'
import {
  OrchestrationSurface,
  TaskActionDialog,
  type TaskActionType,
  type OrchestrationViewFilters,
} from '@/components/orchestration'
import { DEFAULT_ORCHESTRATION_VIEW_FILTERS, buildApiOrchestrationFilters } from '@/components/orchestration/filter-utils'
import {
  useControlOrchestration,
  useWorkspaceId,
  type OrchestrationData,
  type OrchestrationTask,
} from '@/hooks'
import { cancelClaim, completeClaim, markClaimBlocked, renewClaim } from '@/lib/api'
import { RefreshCw } from 'lucide-react'
import { Button } from '@mdplane/ui/ui/button'

const emptyData: OrchestrationData = {
  tasks: [],
  summary: {
    pending: 0,
    claimed: 0,
    completed: 0,
    stalled: 0,
    cancelled: 0,
  },
  pagination: {
    hasMore: false,
  },
}

export default function OrchestrationPage() {
  const workspaceId = useWorkspaceId()
  const [filters, setFilters] = useState<OrchestrationViewFilters>(DEFAULT_ORCHESTRATION_VIEW_FILTERS)
  const [isTakingAction, setIsTakingAction] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<OrchestrationTask | null>(null)

  const apiFilters = useMemo(() => buildApiOrchestrationFilters(filters), [filters])

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useControlOrchestration(workspaceId, apiFilters)

  const handleTakeAction = async (task: OrchestrationTask, action: TaskActionType, reason?: string) => {
    const claimId = task.claim?.id
    if (!workspaceId || !claimId) return

    setIsTakingAction(claimId)
    try {
      let result: Awaited<ReturnType<typeof renewClaim>>

      switch (action) {
        case 'reclaim':
        case 'renew': {
          result = await renewClaim(workspaceId, claimId, 900)
          break
        }
        case 'complete': {
          result = await completeClaim(workspaceId, claimId, reason)
          break
        }
        case 'cancel': {
          result = await cancelClaim(workspaceId, claimId, reason)
          break
        }
        case 'block': {
          if (!reason?.trim()) {
            throw new Error('Block reason is required')
          }
          result = await markClaimBlocked(workspaceId, claimId, reason.trim())
          break
        }
      }

      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to apply task action')
      }

      await refetch()
      setActiveTask(null)
    } finally {
      setIsTakingAction(null)
    }
  }

  return (
    <div className='flex flex-col'>
      <ControlHeader
        title='Orchestration'
        description='Operational task flow across the selected workspace.'
        actions={(
          <Button
            type='button'
            size='icon-sm'
            variant='outline'
            onClick={() => {
              void refetch()
            }}
            disabled={isFetching || isTakingAction !== null}
            aria-label='Refresh orchestration'
          >
            <RefreshCw className={isFetching || isTakingAction !== null ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
        )}
      />

      <ControlContent>
        <OrchestrationSurface
          data={data || emptyData}
          isLoading={isLoading}
          error={error instanceof Error ? error : null}
          filters={filters}
          onRefresh={() => {
            void refetch()
          }}
          onFiltersChange={setFilters}
          showTakeAction
          onTakeAction={setActiveTask}
        />
        <TaskActionDialog
          open={Boolean(activeTask)}
          task={activeTask}
          isSubmitting={isTakingAction !== null}
          onOpenChange={(open) => {
            if (!open) setActiveTask(null)
          }}
          onSubmit={handleTakeAction}
        />
      </ControlContent>
    </div>
  )
}

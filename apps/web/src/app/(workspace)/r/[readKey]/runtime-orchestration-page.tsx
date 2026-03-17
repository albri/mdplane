'use client'

import { FormEvent, useMemo, useState } from 'react'
import { AppFooter } from '@/components/shell'
import { CAPABILITY_ROUTES } from '@mdplane/shared'
import {
  OrchestrationSurface,
  TaskActionDialog,
  type TaskActionType,
  type OrchestrationViewFilters,
} from '@/components/orchestration'
import { DEFAULT_ORCHESTRATION_VIEW_FILTERS, buildApiOrchestrationFilters } from '@/components/orchestration/filter-utils'
import { useIsOwner, useWorkspaceOrchestration, type OrchestrationData, type OrchestrationTask } from '@/hooks'
import { cancelClaim, completeClaim, markClaimBlocked, renewClaim } from '@/lib/api'
import { extractWriteKey } from '@/lib/extract-write-key'
import { Badge } from '@/components/ui/badge'
import { Button } from '@mdplane/ui/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw } from 'lucide-react'
import { capabilityProxyRoute } from '@/lib/capability/proxy-route'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface RuntimeOrchestrationPageProps {
  readKey: string
}

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

export function RuntimeOrchestrationPage({ readKey }: RuntimeOrchestrationPageProps) {
  const [filters, setFilters] = useState<OrchestrationViewFilters>(DEFAULT_ORCHESTRATION_VIEW_FILTERS)
  const [activeTask, setActiveTask] = useState<OrchestrationTask | null>(null)
  const [isTakingAction, setIsTakingAction] = useState<string | null>(null)
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false)
  const [writeKeyInput, setWriteKeyInput] = useState('')
  const [unlockedWriteKey, setUnlockedWriteKey] = useState<string | null>(null)
  const apiFilters = useMemo(() => buildApiOrchestrationFilters(filters), [filters])
  const { isOwner, workspaceId } = useIsOwner(readKey)
  const resolvedWriteKey = extractWriteKey(writeKeyInput)
  const canTakeAction = isOwner || Boolean(unlockedWriteKey)

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useWorkspaceOrchestration(readKey, apiFilters)

  async function applyWriteKeyAction(task: OrchestrationTask, action: TaskActionType, reason?: string) {
    if (!unlockedWriteKey) {
      throw new Error('Write key is required')
    }
    const claimId = task.claim?.id
    const normalizedPath = task.file.path.startsWith('/') ? task.file.path.slice(1) : task.file.path
    const pathSegments = normalizedPath.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment))
    if (pathSegments.length === 0) {
      throw new Error('Task path is required')
    }

    const endpoint = capabilityProxyRoute(
      `${CAPABILITY_ROUTES.byKeyType('a', encodeURIComponent(unlockedWriteKey))}/${pathSegments.join('/')}`
    )
    const payload: {
      author: string
      type: 'renew' | 'response' | 'cancel' | 'blocked'
      ref: string
      expiresInSeconds?: number
      content?: string
    } = {
      author: 'human-operator',
      type: 'renew',
      ref: '',
    }

    switch (action) {
      case 'reclaim':
      case 'renew': {
        if (!claimId) throw new Error('Claim reference missing')
        payload.type = 'renew'
        payload.ref = claimId
        payload.expiresInSeconds = 900
        break
      }
      case 'complete': {
        if (!claimId) throw new Error('Claim reference missing')
        payload.type = 'response'
        payload.ref = claimId
        payload.content = reason?.trim() || 'Resolved from runtime orchestration'
        break
      }
      case 'cancel': {
        if (!claimId) throw new Error('Claim reference missing')
        payload.type = 'cancel'
        payload.ref = claimId
        if (reason?.trim()) payload.content = reason.trim()
        break
      }
      case 'block': {
        if (!claimId) throw new Error('Claim reference missing')
        payload.type = 'blocked'
        payload.ref = claimId
        payload.content = reason?.trim()
        if (!payload.content) {
          throw new Error('Block reason is required')
        }
        break
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const json = await response.json().catch(() => null) as
      | { ok?: boolean; error?: { message?: string } }
      | null
    if (!response.ok || !json?.ok) {
      throw new Error(json?.error?.message || 'Failed to apply action with write key')
    }
  }

  const handleTakeAction = async (task: OrchestrationTask, action: TaskActionType, reason?: string) => {
    const claimId = task.claim?.id
    if (!claimId) return

    setIsTakingAction(claimId)
    try {
      if (isOwner && workspaceId) {
        const result = await (async () => {
          switch (action) {
            case 'reclaim':
            case 'renew':
              return renewClaim(workspaceId, claimId, 900)
            case 'complete':
              return completeClaim(workspaceId, claimId, reason)
            case 'cancel':
              return cancelClaim(workspaceId, claimId, reason)
            case 'block':
              if (!reason?.trim()) {
                throw new Error('Block reason is required')
              }
              return markClaimBlocked(workspaceId, claimId, reason.trim())
          }
        })()

        if (!result.ok) {
          throw new Error(result.error?.message || 'Failed to apply task action')
        }
      } else {
        await applyWriteKeyAction(task, action, reason)
      }
      await refetch()
      setActiveTask(null)
    } finally {
      setIsTakingAction(null)
    }
  }

  function handleUnlockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resolvedWriteKey) return
    setUnlockedWriteKey(resolvedWriteKey)
    setWriteKeyInput('')
    setUnlockDialogOpen(false)
  }

  const handleRefresh = () => {
    void refetch()
  }

  const getTaskHref = (task: OrchestrationTask) => {
    const normalizedPath = task.file.path.startsWith('/') ? task.file.path : `/${task.file.path}`
    const encodedPath = normalizedPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    return encodedPath.length > 0 ? `/r/${readKey}/${encodedPath}` : `/r/${readKey}`
  }

  return (
    <article className='mx-auto flex w-full max-w-[900px] flex-col [grid-area:main] gap-4 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14'>
      <header className='mb-2 border-b border-border/70 pb-4'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>Orchestration</h1>
            <p className='mt-1.5 text-sm text-muted-foreground'>
              Operational task flow across this workspace.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              size='icon-sm'
              variant='outline'
              onClick={handleRefresh}
              disabled={isFetching || isTakingAction !== null}
              aria-label='Refresh orchestration'
            >
              <RefreshCw className={isFetching || isTakingAction !== null ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </Button>
            {!isOwner ? (
              unlockedWriteKey ? (
                <>
                  <Badge variant='outline' className='bg-secondary'>
                    Write key unlocked
                  </Badge>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => setUnlockedWriteKey(null)}
                  >
                    Clear key
                  </Button>
                </>
              ) : (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => setUnlockDialogOpen(true)}
                >
                  Unlock actions
                </Button>
              )
            ) : null}
          </div>
        </div>
      </header>

      <OrchestrationSurface
        data={data || emptyData}
        isLoading={isLoading}
        error={error instanceof Error ? error : null}
        filters={filters}
        onRefresh={handleRefresh}
        onFiltersChange={setFilters}
        getTaskHref={getTaskHref}
        showTakeAction={canTakeAction}
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
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock orchestration actions</DialogTitle>
            <DialogDescription>
              Paste a write key to enable human-in-the-loop actions for this runtime session.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUnlockSubmit} className='space-y-4'>
            <Input
              value={writeKeyInput}
              onChange={(event) => setWriteKeyInput(event.target.value)}
              placeholder='Paste write key or /claim URL'
              autoFocus
            />
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setUnlockDialogOpen(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={!resolvedWriteKey}>
                Unlock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AppFooter />
    </article>
  )
}

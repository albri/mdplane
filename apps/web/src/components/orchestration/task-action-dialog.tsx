'use client'

import { useEffect, useMemo, useState } from 'react'
import type { OrchestrationTask } from '@/hooks'
import { Button } from '@mdplane/ui/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@mdplane/ui/lib/utils'

export type TaskActionType = 'renew' | 'reclaim' | 'complete' | 'cancel' | 'block'

interface TaskActionOption {
  type: TaskActionType
  label: string
  description: string
  requiresReason?: boolean
  reasonLabel?: string
  reasonPlaceholder?: string
}

interface TaskActionDialogProps {
  open: boolean
  task: OrchestrationTask | null
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (task: OrchestrationTask, action: TaskActionType, reason?: string) => Promise<void>
}

const CLAIMED_ACTIONS: TaskActionOption[] = [
  {
    type: 'renew',
    label: 'Renew claim',
    description: 'Extend claim expiry to keep work in progress.',
  },
  {
    type: 'complete',
    label: 'Resolve',
    description: 'Mark this claim as completed.',
    requiresReason: true,
    reasonLabel: 'Resolution note',
    reasonPlaceholder: 'Briefly describe the resolution',
  },
  {
    type: 'block',
    label: 'Mark blocked',
    description: 'Mark this claim as blocked and capture why.',
    requiresReason: true,
    reasonLabel: 'Block reason',
    reasonPlaceholder: 'What is blocking progress?',
  },
  {
    type: 'cancel',
    label: 'Cancel',
    description: 'Cancel this claim and return work to pending.',
    requiresReason: true,
    reasonLabel: 'Cancellation reason',
    reasonPlaceholder: 'Why should this claim be cancelled?',
  },
]

const STALLED_ACTIONS: TaskActionOption[] = [
  {
    type: 'reclaim',
    label: 'Reclaim',
    description: 'Re-open this stale claim for active progress.',
  },
  {
    type: 'complete',
    label: 'Resolve',
    description: 'Mark this stalled work as completed.',
    requiresReason: true,
    reasonLabel: 'Resolution note',
    reasonPlaceholder: 'Briefly describe the resolution',
  },
  {
    type: 'cancel',
    label: 'Cancel',
    description: 'Cancel this stale claim and leave task unclaimed.',
    requiresReason: true,
    reasonLabel: 'Cancellation reason',
    reasonPlaceholder: 'Why should this stale claim be cancelled?',
  },
]

export function TaskActionDialog({
  open,
  task,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: TaskActionDialogProps) {
  const [selectedAction, setSelectedAction] = useState<TaskActionType | null>(null)
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const options = useMemo(() => {
    if (!task) return []
    if (task.status === 'stalled') return STALLED_ACTIONS
    if (task.status === 'claimed') return CLAIMED_ACTIONS
    return []
  }, [task])

  const activeOption = useMemo(
    () => options.find((option) => option.type === selectedAction) ?? null,
    [options, selectedAction]
  )

  useEffect(() => {
    if (!open) return
    const nextDefault = options[0]?.type ?? null
    setSelectedAction(nextDefault)
    setReason('')
    setErrorMessage(null)
  }, [open, options])

  const canSubmit = Boolean(task && selectedAction) &&
    (!activeOption?.requiresReason || reason.trim().length > 0)
  const taskTitle = task?.content.split('\n')[0]?.trim() || task?.file.path || ''

  async function handleSubmit() {
    if (!task || !selectedAction || !canSubmit) return
    setErrorMessage(null)
    try {
      await onSubmit(task, selectedAction, reason.trim() || undefined)
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply action'
      setErrorMessage(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take action</DialogTitle>
          <DialogDescription>
            {task ? (
              <span className='space-y-1'>
                <span className='block text-sm font-medium text-foreground'>{taskTitle}</span>
                <span className='block font-mono text-xs'>{task.file.path}</span>
              </span>
            ) : (
              'Choose the action to apply to this task.'
            )}
          </DialogDescription>
        </DialogHeader>

        {options.length > 0 ? (
          <div className='space-y-3'>
            <div className='grid gap-2 sm:grid-cols-2'>
              {options.map((option) => {
                const isSelected = option.type === selectedAction
                return (
                  <button
                    key={option.type}
                    type='button'
                    onClick={() => setSelectedAction(option.type)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border/80 bg-secondary hover:bg-secondary/80'
                    )}
                    aria-pressed={isSelected}
                    disabled={isSubmitting}
                  >
                    <p className='text-sm font-medium text-foreground'>{option.label}</p>
                    <p className='mt-1 text-xs text-muted-foreground'>{option.description}</p>
                  </button>
                )
              })}
            </div>

            {activeOption?.requiresReason ? (
              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  {activeOption.reasonLabel ?? 'Details'}
                </p>
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={activeOption.reasonPlaceholder ?? 'Add context'}
                  disabled={isSubmitting}
                />
              </div>
            ) : null}

            {errorMessage ? (
              <p className='text-sm text-destructive'>{errorMessage}</p>
            ) : null}
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>
            No actions are available for this task state.
          </p>
        )}

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Close
          </Button>
          <Button type='button' onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Applying...' : 'Apply action'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

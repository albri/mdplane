'use client'

import Link from 'next/link'
import { Button } from '@mdplane/ui/ui/button'
import { Clock3, FileText, User, UserCheck } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'
import type { OrchestrationTask } from '@/hooks'
import { ORCHESTRATION_STATUS_META } from './orchestration-meta'
import { MetaChip, PriorityBadge, StatusAccentLine } from './orchestration-primitives'

interface TaskCardProps {
  task: OrchestrationTask
  taskHref?: string | null
  showTakeAction?: boolean
  onTakeAction?: (task: OrchestrationTask) => void
}

function getTimeRemaining(expiresAt: string): string {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diff = expires.getTime() - now.getTime()

  if (diff <= 0) return 'Expired'

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m left`
  return `${minutes}m left`
}

function getRelativeAge(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ago`
  return `${minutes}m ago`
}

function getTaskTitle(task: OrchestrationTask): string {
  const contentTitle = task.content.split('\n')[0]?.trim()
  if (contentTitle) return contentTitle.slice(0, 100)

  const normalizedPath = task.file.path.startsWith('/') ? task.file.path.slice(1) : task.file.path
  return normalizedPath.split('/').pop() || task.file.path
}

export function TaskCard({ task, taskHref, showTakeAction = false, onTakeAction }: TaskCardProps) {
  const statusMeta = ORCHESTRATION_STATUS_META[task.status]
  const StatusIcon = statusMeta.icon
  const labels = Array.isArray(task.labels) ? task.labels : []
  const timeLabel = getRelativeAge(task.createdAt)
  const claimTimeLabel =
    task.claim?.expiresAt && task.status === 'claimed'
      ? getTimeRemaining(task.claim.expiresAt)
      : null
  const isActionable = showTakeAction && Boolean(task.claim?.id) && (task.status === 'claimed' || task.status === 'stalled')
  const taskTitle = getTaskTitle(task)
  const taskPath = task.file.path
  const claimedBy = task.claim?.author || null

  return (
    <article
      className='overflow-hidden rounded-xl border border-border/80 bg-secondary shadow-sm'
      data-testid='orchestration-task-card'
      data-task-status={task.status}
    >
      <header className='flex items-start justify-between gap-3 px-3 py-2 text-secondary-foreground'>
        <div className='flex min-w-0 items-center gap-2'>
          <StatusAccentLine className={statusMeta.accentClassName} />
          <StatusIcon className={cn('h-4 w-4 shrink-0', statusMeta.iconClassName)} aria-hidden />
          <span className='truncate text-sm font-medium' title={taskTitle}>
            {taskTitle}
          </span>
        </div>
        <span className='shrink-0 text-xs text-muted-foreground'>{timeLabel}</span>
      </header>

      <div className='rounded-xl bg-card px-3 py-2.5'>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <FileText className='h-3.5 w-3.5' />
          {taskHref ? (
            <Link href={taskHref} className='truncate font-mono text-primary hover:underline'>
              {taskPath}
            </Link>
          ) : (
            <span className='truncate font-mono'>{taskPath}</span>
          )}
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2 text-xs'>
          {task.priority ? <PriorityBadge priority={task.priority} /> : null}

          {labels.map((label) => (
            <span
              key={label}
              className='rounded-md border border-border/70 bg-accent/60 px-2 py-0.5 text-xs text-accent-foreground'
            >
              {label}
            </span>
          ))}

          {claimTimeLabel ? (
            <span className='inline-flex items-center gap-1 text-muted-foreground'>
              <Clock3 className='h-3.5 w-3.5' />
              {claimTimeLabel}
            </span>
          ) : null}

          {task.status === 'stalled' && task.claim?.expiresAt ? (
            <span className='text-status-blocked'>Expired {getRelativeAge(task.claim.expiresAt)}</span>
          ) : null}

          <div className='ml-auto flex min-w-0 flex-wrap items-center gap-1.5'>
            <MetaChip label='Author' value={task.author} icon={User} />
            {claimedBy ? <MetaChip label='Claimed by' value={claimedBy} icon={UserCheck} /> : null}
          </div>
        </div>

        {isActionable ? (
          <div className='mt-2 flex items-center justify-end border-t border-border/70 pt-2'>
            <Button size='sm' variant='outline' onClick={() => onTakeAction?.(task)}>
              Take action
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

'use client'

import type { Append } from '@mdplane/shared'
import { cn } from '@mdplane/ui/lib/utils'
import { Hash, User } from 'lucide-react'
import { APPEND_TYPE_META } from '@/components/orchestration/orchestration-meta'
import { MetaChip, PriorityBadge, StatusAccentLine, StatusBadge } from '@/components/orchestration/orchestration-primitives'

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}

interface AppendEntryProps {
  append: Append
  className?: string
}

export function AppendEntry({ append, className }: AppendEntryProps) {
  const config = APPEND_TYPE_META[append.type] || APPEND_TYPE_META.comment
  const Icon = config.icon
  const timeAgo = formatRelativeTime(new Date(append.ts))
  const statusLabel = append.status ?? null
  const hasFooterLeft =
    Boolean(append.priority) ||
    Boolean(append.labels?.length) ||
    Boolean(statusLabel) ||
    Boolean(append.completedAt) ||
    Boolean(append.expiresAt) ||
    Boolean(append.value)
  const hasFooterRight = Boolean(append.author) || Boolean(append.ref)
  const showFooter = hasFooterLeft || hasFooterRight

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/80 bg-secondary shadow-sm',
        className
      )}
      data-append-id={append.id}
      data-append-type={append.type}
    >
      <div className='flex items-start justify-between gap-3 px-3 py-2 text-secondary-foreground'>
        <div className='flex min-w-0 items-center gap-2'>
          <StatusAccentLine className={config.accentClassName} />
          <Icon className={cn('h-4 w-4 shrink-0', config.iconClassName)} />
          <span className='truncate text-sm font-medium'>{config.label}</span>
        </div>
        <span className='shrink-0 text-xs text-muted-foreground'>{timeAgo}</span>
      </div>

      <div className='rounded-xl bg-card px-3 py-2.5'>
        {append.content ? (
          <div className='whitespace-pre-wrap text-sm text-foreground'>{append.content}</div>
        ) : null}

        {showFooter ? (
          <div
            className={cn(
              'flex flex-wrap items-center gap-2 border-border/70 pt-2 text-xs',
              append.content && 'mt-3 border-t'
            )}
          >
            <div className='flex flex-1 flex-wrap items-center gap-1.5'>
              {append.priority ? <PriorityBadge priority={append.priority} /> : null}
              {append.labels?.map((label) => (
                <span
                  key={label}
                  className='rounded-md border border-border/70 bg-accent/60 px-2 py-0.5 text-xs text-accent-foreground'
                >
                  {label}
                </span>
              ))}
              {statusLabel ? <StatusBadge status={statusLabel} /> : null}
              {append.type === 'vote' && append.value ? (
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-semibold',
                    append.value === '+1'
                      ? 'border border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300'
                      : 'border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                  )}
                >
                  {append.value}
                </span>
              ) : null}
              {append.expiresAt ? (
                <span className='text-muted-foreground'>
                  Expires {new Date(append.expiresAt).toLocaleString()}
                </span>
              ) : null}
              {append.completedAt ? (
                <span className='text-muted-foreground'>
                  Completed {new Date(append.completedAt).toLocaleString()}
                </span>
              ) : null}
            </div>

            {hasFooterRight ? (
              <div className='ml-auto flex min-w-0 flex-wrap items-center gap-1.5'>
                {append.author ? <MetaChip label='Author' value={append.author} icon={User} /> : null}
                {append.ref ? (
                  <MetaChip label='Ref' value={append.ref} icon={Hash} valueClassName='max-w-[16rem] truncate' />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

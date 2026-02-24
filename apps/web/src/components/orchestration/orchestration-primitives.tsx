'use client'

import { cn } from '@mdplane/ui/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { APPEND_STATUS_BADGE_META, ORCHESTRATION_PRIORITY_META } from './orchestration-meta'

export function StatusAccentLine({ className }: { className: string }) {
  return <span className={cn('h-5 w-0.5 shrink-0 rounded-sm', className)} aria-hidden />
}

interface DotBadgeProps {
  label: string
  dotClassName: string
  className?: string
}

export function DotBadge({ label, dotClassName, className }: DotBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-accent/60 px-2 py-0.5 text-xs text-accent-foreground',
        className
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', dotClassName)} aria-hidden />
      {label}
    </span>
  )
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority?: string | null
  className?: string
}) {
  if (!priority) return null

  if (Object.prototype.hasOwnProperty.call(ORCHESTRATION_PRIORITY_META, priority)) {
    const key = priority as keyof typeof ORCHESTRATION_PRIORITY_META
    const meta = ORCHESTRATION_PRIORITY_META[key]
    return <DotBadge label={meta.label} dotClassName={meta.dotClassName} className={className} />
  }

  return <DotBadge label={titleCase(priority)} dotClassName='bg-muted-foreground/60' className={className} />
}

function titleCase(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function StatusBadge({
  status,
  className,
}: {
  status?: string | null
  className?: string
}) {
  if (!status) return null
  const normalized = status.toLowerCase()
  const knownMeta = APPEND_STATUS_BADGE_META[normalized as keyof typeof APPEND_STATUS_BADGE_META]

  if (knownMeta) {
    return <DotBadge label={knownMeta.label} dotClassName={knownMeta.dotClassName} className={className} />
  }

  return <DotBadge label={titleCase(status)} dotClassName='bg-muted-foreground/60' className={className} />
}

export function MetaChip({
  label,
  value,
  icon: Icon,
  className,
  valueClassName,
}: {
  label: string
  value: string
  icon?: LucideIcon
  className?: string
  valueClassName?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-accent/60 px-2 py-0.5 text-xs',
        className
      )}
      aria-label={`${label}: ${value}`}
      title={`${label}: ${value}`}
    >
      {Icon ? <Icon className='h-3 w-3 shrink-0 text-muted-foreground' aria-hidden /> : null}
      <span className={cn('font-mono text-foreground', valueClassName)}>{value}</span>
    </span>
  )
}

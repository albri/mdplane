'use client'

import type { Append } from '@mdplane/shared'
import { AppendEntry } from './append-entry'
import { cn } from '@mdplane/ui/lib/utils'

interface AppendSectionProps {
  appends: Append[]
  className?: string
}

export function AppendSection({ appends, className }: AppendSectionProps) {
  if (!appends || appends.length === 0) {
    return null
  }

  const displayableAppends = appends.filter((a) => a.type !== 'heartbeat')

  if (displayableAppends.length === 0) {
    return null
  }

  return (
    <section className={cn('mt-10', className)}>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-secondary shadow-sm">
        <div className="flex w-full items-center gap-3.5 px-4 text-secondary-foreground">
          <div
            role="heading"
            aria-level={2}
            className="py-3 text-base font-semibold leading-none text-muted-foreground"
          >
            Activity
          </div>
          <span className="ml-auto rounded-md border border-border/70 bg-card px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {displayableAppends.length}
          </span>
        </div>
        <div className="rounded-xl bg-card p-4">
          <div className="space-y-3">
            {displayableAppends.map((append) => (
              <AppendEntry key={append.id} append={append} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}


'use client'

import { Skeleton } from '@/components/ui/skeletons'

export function OrchestrationSkeleton() {
  const sections = [
    { label: 'Needs claim', cards: 2 },
    { label: 'In progress', cards: 2 },
    { label: 'Blocked / stalled', cards: 1 },
  ]

  return (
    <div
      className="space-y-4"
      role="status"
      aria-label="Loading tasks"
    >
      {sections.map((section, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-border/80 bg-secondary p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-10" />
          </div>
          <div className="rounded-xl bg-card p-3">
            <div className="space-y-3">
              {Array.from({ length: section.cards }).map((_, j) => (
                <div key={j} className="space-y-3 rounded-xl border border-border/80 bg-secondary p-3 shadow-sm">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="space-y-3 rounded-xl border border-border/80 bg-secondary p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-10" />
        </div>
        <div className="rounded-xl bg-card p-3">
          <div className="space-y-3">
            <div className="space-y-3 rounded-xl border border-border/80 bg-secondary p-3 shadow-sm">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Loading tasks...</span>
    </div>
  )
}



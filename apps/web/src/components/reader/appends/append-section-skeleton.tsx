'use client'

import { cn } from '@mdplane/ui/lib/utils'
import { Skeleton } from '@/components/ui/skeletons'

interface AppendSectionSkeletonProps {
  className?: string
  count?: number
}

export function AppendSectionSkeleton({ className, count = 3 }: AppendSectionSkeletonProps) {
  return (
    <section
      className={cn('mt-10', className)}
      role="status"
      aria-label="Loading activity"
    >
      <div className="overflow-hidden rounded-xl border border-border/80 bg-secondary shadow-sm">
        <div className="flex w-full items-center gap-3.5 px-4 py-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-5 w-8 rounded-md" />
        </div>
        <div className="rounded-xl bg-card p-4">
          <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-0.5 rounded-sm" />
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="mt-2 space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-2">
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-12 rounded-md" />
                  <Skeleton className="ml-auto h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Loading activity...</span>
    </section>
  )
}


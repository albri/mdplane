'use client'

import { cn } from '@mdplane/ui/lib/utils'

/**
 * Base Skeleton component with pulse animation.
 * Uses motion-reduce for accessibility.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-sm bg-muted motion-reduce:animate-none',
        className
      )}
      {...props}
    />
  )
}

/**
 * Page header skeleton (title + description).
 */
export function HeaderSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading header">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-96" />
      <span className="sr-only">Loading...</span>
    </div>
  )
}

/**
 * Table/list skeleton with configurable rows.
 */
export function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  )
}

/**
 * Card skeleton for individual card loading.
 */
export function CardSkeleton() {
  return (
    <div className="surface-panel space-y-3 p-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

/**
 * Full page skeleton (header + content).
 */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading page">
      <HeaderSkeleton />
      <TableSkeleton rows={rows} />
      <span className="sr-only">Loading...</span>
    </div>
  )
}

/**
 * Stats grid skeleton for control overview.
 */
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-label="Loading statistics"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-panel space-y-3 p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
      <span className="sr-only">Loading statistics...</span>
    </div>
  )
}

/**
 * Claims grid skeleton (for claims page with card grid).
 */
export function ClaimsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading claimed tasks"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-panel space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading tasks...</span>
    </div>
  )
}

/**
 * API Keys / Webhooks list skeleton.
 */
export function ItemsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 md:grid-cols-2"
      role="status"
      aria-label="Loading items"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-panel space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-5" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  )
}

/**
 * Document content skeleton for markdown pages.
 * Mimics title, badge, toolbar, and content paragraphs.
 */
export function DocumentSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading document">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-1" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="mt-8 h-7 w-48" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
      </div>
      <span className="sr-only">Loading document...</span>
    </div>
  )
}

/**
 * Folder listing skeleton.
 * Mimics a list of file/folder items.
 */
export function FolderListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading folder">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="surface-panel flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
      ))}
      <span className="sr-only">Loading folder contents...</span>
    </div>
  )
}



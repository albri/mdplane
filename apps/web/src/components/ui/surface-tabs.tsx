'use client'

import * as React from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cn } from '@mdplane/ui/lib/utils'

function SurfaceTabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="surface-tabs"
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border/80 bg-secondary',
        className
      )}
      {...props}
    />
  )
}

function SurfaceTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="surface-tabs-list"
      className={cn(
        'flex w-full items-center gap-3.5 overflow-x-auto px-4 text-secondary-foreground',
        className
      )}
      {...props}
    />
  )
}

function SurfaceTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="surface-tabs-trigger"
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap border-b border-transparent py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[selected]:border-primary data-[selected]:text-primary data-[selected=true]:border-primary data-[selected=true]:text-primary aria-[selected=true]:border-primary aria-[selected=true]:text-primary',
        className
      )}
      {...props}
    />
  )
}

function SurfaceTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="surface-tabs-content"
      className={cn('rounded-xl bg-background p-4 outline-none', className)}
      {...props}
    />
  )
}

export { SurfaceTabs, SurfaceTabsList, SurfaceTabsTrigger, SurfaceTabsContent }


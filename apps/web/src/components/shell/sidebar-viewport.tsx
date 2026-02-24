'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@mdplane/ui/lib/utils'

interface SidebarViewportProps {
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function SidebarViewport({ children, className, contentClassName }: SidebarViewportProps) {
  return (
    <ScrollArea className={cn('relative z-0 min-h-0 flex-1', className)}>
      <div
        className={cn('p-4', contentClassName)}
        style={{ maskImage: 'linear-gradient(to bottom, transparent, white 12px, white calc(100% - 12px), transparent)' }}
      >
        {children}
      </div>
    </ScrollArea>
  )
}


'use client'

import { cn } from '@mdplane/ui/lib/utils'

interface SidebarFooterProps {
  children: React.ReactNode
  className?: string
}

export function SidebarFooter({ children, className }: SidebarFooterProps) {
  return (
    <div className={cn('relative z-10 flex flex-col border-t border-sidebar-border p-4 pt-2 empty:hidden', className)}>
      {children}
    </div>
  )
}


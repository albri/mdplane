'use client'

import { cn } from '@mdplane/ui/lib/utils'

interface SidebarSectionProps {
  title?: string
  children: React.ReactNode
  className?: string
}

export function SidebarSection({ title, children, className }: SidebarSectionProps) {
  return (
    <section data-slot="sidebar-section" className={cn('space-y-1.5', className)}>
      {title ? (
        <p
          data-slot="sidebar-section-title"
          className="mb-1.5 inline-flex items-center gap-2 px-2 text-foreground empty:mb-0 [&_svg]:size-4 [&_svg]:shrink-0"
          style={{ paddingInlineStart: 'calc(2 * var(--spacing))' }}
        >
          {title}
        </p>
      ) : null}
      {children}
    </section>
  )
}



'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@mdplane/ui/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface SidebarItemProps {
  href: string
  label: string
  icon: LucideIcon
  className?: string
  nested?: boolean
}

export function SidebarItem({ href, label, icon: Icon, className, nested = false }: SidebarItemProps) {
  const pathname = usePathname()
  const segments = href.split('/').filter(Boolean)
  const isWorkspaceOverviewHref = segments.length === 2 && segments[0] === 'control' && segments[1].startsWith('ws_')
  const isActive = pathname === href || (!isWorkspaceOverviewHref && href !== '/control' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      data-active={isActive}
      className={cn(
        'relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-sm text-muted-foreground wrap-anywhere transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent/50 hover:text-accent-foreground/80 hover:transition-none data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:hover:transition-colors',
        nested
          ? 'data-[active=true]:before:absolute data-[active=true]:before:inset-y-2.5 data-[active=true]:before:start-2.5 data-[active=true]:before:w-px data-[active=true]:before:bg-primary'
          : null,
        className
      )}
    >
      <Icon />
      {label}
    </Link>
  )
}


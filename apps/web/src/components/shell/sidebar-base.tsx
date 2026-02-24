'use client'

import { cn } from '@mdplane/ui/lib/utils'
import type { ComponentProps } from 'react'
import { useSidebarContext } from './sidebar-context'

export function SidebarTrigger({
  children,
  className,
  onClick,
  ...props
}: ComponentProps<'button'>) {
  const { setOpen } = useSidebarContext()

  return (
    <button
      type="button"
      aria-label="Toggle menu"
      className={cn(className)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          setOpen((prev) => !prev)
        }
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarCollapseTrigger({
  children,
  className,
  onClick,
  ...props
}: ComponentProps<'button'>) {
  const { collapsed, setCollapsed } = useSidebarContext()
  return (
    <button
      type="button"
      className={cn(className)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          setCollapsed((prev) => !prev)
        }
      }}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      data-collapsed={collapsed}
      {...props}
    >
      {children}
    </button>
  )
}


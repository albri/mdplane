'use client'

import { cn } from '@mdplane/ui/lib/utils'
import { useEffect, useState } from 'react'
import { useSidebarContext } from './sidebar-context'

interface SidebarDrawerProps {
  children: React.ReactNode
  className?: string
}

export function SidebarDrawer({ children, className }: SidebarDrawerProps) {
  const { open, mode, setOpen } = useSidebarContext()
  const [hidden, setHidden] = useState(!open)

  if (open && hidden) {
    setHidden(false)
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])

  if (mode !== 'drawer') return null

  return (
    <>
      {!hidden ? (
        <div
          data-state={open ? 'open' : 'closed'}
          className={cn(
            'fixed inset-0 z-40 backdrop-blur-xs transition-opacity duration-200',
            open ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setOpen(false)}
          onTransitionEnd={() => {
            if (!open) setHidden(true)
          }}
          aria-hidden="true"
        />
      ) : null}
      <aside
        id="app-sidebar-mobile"
        data-state={open ? 'open' : 'closed'}
        className={cn(
          'fixed inset-y-0 end-0 z-40 flex w-[85%] max-w-[380px] flex-col border-s border-sidebar-border bg-sidebar text-[0.9375rem] text-sidebar-foreground shadow-lg transition-transform duration-200',
          hidden ? 'invisible' : null,
          open ? 'translate-x-0' : 'translate-x-full',
          className
        )}
        onTransitionEnd={() => {
          if (!open) setHidden(true)
        }}
        aria-hidden={!open}
      >
        {children}
      </aside>
    </>
  )
}


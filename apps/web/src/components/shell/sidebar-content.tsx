'use client'

import { cn } from '@mdplane/ui/lib/utils'
import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { PanelLeft } from 'lucide-react'
import { SidebarCollapseTrigger } from './sidebar-base'
import { useSidebarContext } from './sidebar-context'
import { sidebarCollapseButtonClassName } from './sidebar-styles'

interface SidebarContentProps {
  children: React.ReactNode
  className?: string
}

export function SidebarContent({ children, className }: SidebarContentProps) {
  const { collapsed, mode } = useSidebarContext()
  const [hovered, setHovered] = useState(false)
  const asideRef = useRef<HTMLElement>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!collapsed) {
      setHovered(false)
    }
  }, [collapsed])

  function clearHoverTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function shouldIgnoreHover(event: PointerEvent<HTMLElement>) {
    const element = asideRef.current
    if (!element) return true
    return !collapsed || event.pointerType === 'touch' || element.getAnimations().length > 0
  }

  function onCollapsedPointerEnter(event: PointerEvent<HTMLElement>) {
    if (shouldIgnoreHover(event)) return
    clearHoverTimer()
    setHovered(true)
  }

  function onCollapsedPointerLeave(event: PointerEvent<HTMLElement>) {
    if (shouldIgnoreHover(event)) return
    clearHoverTimer()
    const distanceFromEdge = Math.min(event.clientX, document.body.clientWidth - event.clientX)
    timerRef.current = window.setTimeout(() => setHovered(false), distanceFromEdge > 100 ? 0 : 500)
  }

  if (mode !== 'full') return null

  return (
    <>
      <div
        data-sidebar-placeholder=""
        className="pointer-events-none sticky top-[var(--shell-row-1)] z-20 h-[calc(var(--shell-height)-var(--shell-row-1))] [grid-area:sidebar] *:pointer-events-auto max-md:hidden md:[--shell-sidebar-width:268px]"
      >
        {collapsed ? (
          <div
            className="absolute inset-y-0 start-0 w-4"
            onPointerEnter={onCollapsedPointerEnter}
            onPointerLeave={onCollapsedPointerLeave}
          />
        ) : null}

        <aside
          id="app-sidebar"
          ref={asideRef}
          data-collapsed={collapsed}
          data-hovered={collapsed && hovered}
          className={cn(
            'absolute inset-y-0 start-0 flex w-full flex-col items-end border-e bg-card text-sm duration-250 *:w-[var(--shell-sidebar-width)]',
            collapsed
              ? hovered
                ? 'inset-y-2 w-[var(--shell-sidebar-width)] translate-x-2 rounded-xl border shadow-lg rtl:-translate-x-2'
                : '-translate-x-full rtl:translate-x-full'
              : 'translate-x-0',
            className
          )}
          onPointerEnter={(event) => collapsed && onCollapsedPointerEnter(event)}
          onPointerLeave={(event) => collapsed && onCollapsedPointerLeave(event)}
        >
          {children}
        </aside>
      </div>

      <div
        data-sidebar-panel=""
        className={cn(
          'fixed start-4 top-[calc(--spacing(4)+var(--shell-row-3))] z-10 flex rounded-lg border bg-card p-0.5 shadow-lg transition-opacity',
          collapsed ? 'opacity-100' : 'pointer-events-none opacity-0',
          hovered ? 'pointer-events-none opacity-0' : null
        )}
      >
        <SidebarCollapseTrigger className={sidebarCollapseButtonClassName}>
          <PanelLeft />
        </SidebarCollapseTrigger>
      </div>
    </>
  )
}

